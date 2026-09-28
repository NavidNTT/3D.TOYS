#!/bin/sh
# ---------------------------------------------------------------------------
#  Toy Store — container entrypoint (shared by laravel.app and laravel.worker)
#
#  Responsibilities:
#    1. Bootstrap the Laravel project on first boot (composer install,
#       .env, APP_KEY, storage dirs) — idempotent and safe to run twice.
#    2. Serialise that bootstrap across containers with flock so the app and
#       the worker never run `composer install` at the same time.
#    3. exec the container command as PID 1 (clean signal handling).
# ---------------------------------------------------------------------------
set -eu

APP_DIR="${APP_DIR:-/var/www/html}"
SETUP_LOCK="${APP_DIR}/.docker-setup.lock"

log() { printf '%s [entrypoint] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2; }

prepare() {
    cd "$APP_DIR" 2>/dev/null || { log "WARN: ${APP_DIR} is not mounted yet, skipping setup"; return 0; }

    # Docker sometimes creates a missing bind-mount source as 0700 root
    # (seen on Docker Desktop for Windows). That blocks every non-root reader
    # — nginx's worker user cannot even stat public/, which surfaces as a
    # confusing 404 "File not found." from nginx instead of hitting Laravel.
    # We run as root here, so normalise it once per boot. nginx waits for this
    # container to be healthy (see docker-compose.yml depends_on).
    chmod 0755 "$APP_DIR" 2>/dev/null || true
    for dir in public storage storage/app storage/framework bootstrap; do
        [ -d "$dir" ] && chmod 0755 "$dir" 2>/dev/null || true
    done

    if [ ! -f composer.json ]; then
        log "no composer.json in ${APP_DIR} — Laravel is not installed yet."
        log "run:  docker compose --env-file .env.docker exec laravel.app bootstrap-laravel.sh"
        return 0
    fi


    if [ ! -d vendor ]; then
        log "installing composer dependencies (first boot, this takes a minute)..."
        composer install --no-interaction --prefer-dist --no-progress
    fi

    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            log "created .env from .env.example"
        fi
    fi

    mkdir -p storage/framework/cache/data \
             storage/framework/sessions \
             storage/framework/views \
             storage/logs \
             bootstrap/cache

    if [ -f artisan ] && ! grep -qE '^APP_KEY=base64:.+' .env 2>/dev/null; then
        log "generating APP_KEY"
        php artisan key:generate --force --no-interaction >/dev/null 2>&1 || true
    fi

    # The FPM workers run as www-data; CLI runs (queue workers) as the
    # container user. Keep the writable trees owned accordingly.
    if [ "$(id -u)" = "0" ]; then
        chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
    fi

    log "setup OK"
}

# ---------------------------------------------------------------------------
#  0. Optionally idle until the Laravel app exists.
#     laravel.worker sets WAIT_FOR_APP=true: a queue worker has nothing to do
#     before the app is scaffolded, and crash-looping it would just spam the
#     logs, so it waits here instead and starts the moment bootstrap finishes.
# ---------------------------------------------------------------------------
WAIT_FOR_APP_LC=$(printf '%s' "${WAIT_FOR_APP:-false}" | tr '[:upper:]' '[:lower:]')
if [ "$WAIT_FOR_APP_LC" = "true" ] && [ ! -f "${APP_DIR}/composer.json" ]; then
    log "WAIT_FOR_APP=true but ${APP_DIR} has no composer.json yet — idling."
    log "scaffold the API with:"
    log "  docker compose --env-file .env.docker exec laravel.app bootstrap-laravel.sh"
    waited=0
    while [ ! -f "${APP_DIR}/composer.json" ]; do
        sleep 5
        waited=$((waited + 5))
        if [ $((waited % 60)) -eq 0 ]; then
            log "still waiting for composer.json (${waited}s)"
        fi
    done
    log "composer.json detected after ${waited}s — continuing with setup"
fi

RUN_SETUP_LC=$(printf '%s' "${RUN_SETUP:-true}" | tr '[:upper:]' '[:lower:]')
if [ "$RUN_SETUP_LC" = "true" ]; then
    if command -v flock >/dev/null 2>&1; then
        # Busybox flock: hold an exclusive lock on fd 9 while bootstrapping.
        ( flock 9; prepare ) 9>"$SETUP_LOCK" || log "WARN: setup step reported a failure, continuing"
    else
        prepare || log "WARN: setup step reported a failure, continuing"
    fi
fi

log "starting: $*"
exec "$@"
