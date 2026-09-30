#!/bin/sh
# ---------------------------------------------------------------------------
#  Toy Store — one-time Laravel bootstrap.
#
#  Run inside the `laravel.app` container after `docker compose up -d`:
#      docker compose --env-file .env.docker exec laravel.app bootstrap-laravel.sh
#
#  Creates the Laravel 12 skeleton in ./backend (bind-mounted to
#  /var/www/html), writes a .env pre-wired to the compose services
#  (MySQL / Redis / MinIO) and runs the initial migration.
# ---------------------------------------------------------------------------
set -eu

APP_DIR="${APP_DIR:-/var/www/html}"
LARAVEL_VERSION="${LARAVEL_VERSION:-^12.0}"

log() { printf '\033[1;36m[bootstrap]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[bootstrap] %s\033[0m\n' "$*" >&2; exit 1; }

cd "$APP_DIR"

if [ -f composer.json ]; then
    log "composer.json already present — nothing to scaffold."
else
    log "creating laravel/laravel:${LARAVEL_VERSION} …"
    # create-project refuses a non-empty directory, so render into a temp
    # dir and copy across (also keeps .gitkeep / your own dotfiles intact).
    tmp="$(mktemp -d)"
    composer create-project "laravel/laravel:${LARAVEL_VERSION}" "$tmp" \
        --no-interaction --prefer-dist --no-progress
    cp -a "$tmp/." "$APP_DIR/"
    rm -rf "$tmp"
    log "skeleton copied to ${APP_DIR}"
fi

# ---------------------------------------------------------------------------
#  .env — every value points at a compose service by name.
#  Container env vars already override these, but a correct file keeps
#  `php artisan tinker` / IDE tooling sane and documents the topology.
# ---------------------------------------------------------------------------
log "writing .env"
cat > .env <<EOF
APP_NAME="${APP_NAME:-Toy Store}"
APP_ENV=${APP_ENV:-local}
APP_KEY=
APP_DEBUG=${APP_DEBUG:-true}
APP_TIMEZONE=UTC
APP_URL=${APP_URL:-http://localhost:8000}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}

LOG_CHANNEL=stderr
LOG_LEVEL=debug

# ── MySQL ─────────────────────────────────────────────────────
DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=${MYSQL_DATABASE:-toy_store_db}
DB_USERNAME=${MYSQL_USER:-toy_store}
DB_PASSWORD=${MYSQL_PASSWORD:-toy_store_secret}

# ── Redis (cache, sessions, queues) ───────────────────────────
CACHE_STORE=redis
SESSION_DRIVER=redis
SESSION_LIFETIME=1200
QUEUE_CONNECTION=redis
REDIS_CLIENT=phpredis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD:-redis_secret}
REDIS_PREFIX=toy_store_

# ── MinIO / S3 (3D assets) ────────────────────────────────────
# Inside the network use the service name; browsers must use the
# published host port (AWS_URL below is what Laravel hands to the client).
FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=${MINIO_ROOT_USER:-toy_admin}
AWS_SECRET_ACCESS_KEY=${MINIO_ROOT_PASSWORD:-toy_admin_secret}
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=${MINIO_BUCKET:-toy-store-assets}
AWS_ENDPOINT=${MINIO_INTERNAL_URL:-http://minio:9000}
AWS_USE_PATH_STYLE_ENDPOINT=true
AWS_URL=http://localhost:${MINIO_API_PORT:-9000}/${MINIO_BUCKET:-toy-store-assets}

# ── Sanctum / CORS (SPA on a different port = cross-origin) ───
SANCTUM_STATEFUL_DOMAINS=localhost:${FRONTEND_PORT:-3000},127.0.0.1:${FRONTEND_PORT:-3000},localhost:${NGINX_PORT:-8000},127.0.0.1:${NGINX_PORT:-8000}
CORS_ALLOWED_ORIGINS=http://localhost:${FRONTEND_PORT:-3000},http://127.0.0.1:${FRONTEND_PORT:-3000},http://localhost:${NGINX_PORT:-8000},http://127.0.0.1:${NGINX_PORT:-8000}
EOF

# ---------------------------------------------------------------------------
#  Permissions, key, database
# ---------------------------------------------------------------------------
log "preparing writable directories"
mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views \
         storage/logs bootstrap/cache storage/app/public storage/app/private
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true

log "generating APP_KEY"
php artisan key:generate --force --no-interaction

log "waiting for MySQL to accept connections…"
i=0
until php -r 'exit(@fsockopen(getenv("DB_HOST") ?: "mysql", (int)(getenv("DB_PORT") ?: 3306)) ? 0 : 1);' 2>/dev/null; do
    i=$((i + 1))
    [ "$i" -ge 30 ] && die "MySQL never became reachable at ${DB_HOST:-mysql}:${DB_PORT:-3306}"
    sleep 2
done

log "running migrations"
php artisan migrate --force --no-interaction

log "linking public storage"
php artisan storage:link --no-interaction >/dev/null 2>&1 || true

cat <<EOF

  ┌──────────────────────────────────────────────────────────────┐
  │  Laravel is ready.                                           │
  │                                                              │
  │  Health       ${APP_URL:-http://localhost:8000}/up
  │  MinIO UI     http://localhost:${MINIO_CONSOLE_PORT:-9001}
  │  Next.js      ${FRONTEND_URL:-http://localhost:3000}
  │                                                              │
  │  queue:work redis is already running in laravel.worker.       │
  └──────────────────────────────────────────────────────────────┘

EOF
