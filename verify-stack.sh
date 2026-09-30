#!/bin/sh
# ---------------------------------------------------------------------------
#  Toy Store — stack verifier
#
#      ./verify-stack.sh                      # uses .env.docker
#      COMPOSE_ENV_FILE=.env ./verify-stack.sh
#
#  Checks, in order:
#    1. every container is running and reports a healthy Docker healthcheck
#       (mysql + redis are the two the brief calls out explicitly)
#    2. MySQL accepts a real query, Redis answers PING
#    3. MinIO API + console answer over HTTP and the asset bucket exists
#    4. nginx -> php-fpm -> Laravel serves /health and /up
#    5. Next.js answers on its own port
#    6. nextjs.app can reach Laravel over the *internal* network by name
#
#  Exit code 0 = everything passed, 1 = at least one hard failure.
# ---------------------------------------------------------------------------
set -u

# Git Bash on Windows rewrites arguments that look like POSIX paths (/dev/null
# becomes C:/Program Files/Git/dev/null), which breaks curl's `-o /dev/null`.
MSYS_NO_PATHCONV=1
MSYS2_ARG_CONV_EXCL='*'
export MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL

ENV_FILE="${COMPOSE_ENV_FILE:-.env.docker}"
DC="docker compose --env-file ${ENV_FILE}"
FAILED=0

if [ ! -f "$ENV_FILE" ]; then
    printf 'env file "%s" not found. Run: cp .env.example %s\n' "$ENV_FILE" "$ENV_FILE" >&2
    exit 1
fi

env_get() {
    grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}
NGINX_PORT="$(env_get NGINX_PORT)"; NGINX_PORT="${NGINX_PORT:-8000}"
FRONTEND_PORT="$(env_get FRONTEND_PORT)"; FRONTEND_PORT="${FRONTEND_PORT:-3000}"
MYSQL_PORT="$(env_get MYSQL_PORT)"; MYSQL_PORT="${MYSQL_PORT:-3307}"
REDIS_PORT="$(env_get REDIS_PORT)"; REDIS_PORT="${REDIS_PORT:-6380}"
MINIO_API_PORT="$(env_get MINIO_API_PORT)"; MINIO_API_PORT="${MINIO_API_PORT:-9000}"
MINIO_CONSOLE_PORT="$(env_get MINIO_CONSOLE_PORT)"; MINIO_CONSOLE_PORT="${MINIO_CONSOLE_PORT:-9001}"
MINIO_BUCKET="$(env_get MINIO_BUCKET)"; MINIO_BUCKET="${MINIO_BUCKET:-toy-store-assets}"

ok()   { printf '  [ ok ]  %s\n' "$1"; }
bad()  { printf '  [FAIL]  %s\n' "$1"; FAILED=1; }
info() { printf '  [ .. ]  %s\n' "$1"; }

# Never append a fallback with `||`: curl can exit non-zero *after* printing a
# status code (e.g. a write error), which used to yield "200000".
http_code() {
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 "$1" 2>/dev/null)"
    if [ -z "$code" ]; then code="000"; fi
    printf '%s' "$code"
}

printf '\nToy Store — stack verification (%s)\n' "$ENV_FILE"
printf -- '-------------------------------------------------------------\n\n'

# ── 1. container state + docker healthchecks ───────────────────────────────
printf '1. Containers and healthchecks\n'
for svc in mysql redis minio laravel.app laravel.worker nginx nextjs.app; do
    cid="$($DC ps -q "$svc" 2>/dev/null | head -1)"
    if [ -z "$cid" ]; then
        bad "$svc: not running (docker compose --env-file $ENV_FILE up -d)"
        continue
    fi
    state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null)"
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null)"
    case "$state:$health" in
        running:healthy) ok "$svc: running, health=healthy" ;;
        running:none)    ok "$svc: running (no healthcheck defined)" ;;
        running:starting) info "$svc: still starting (health=starting) — re-run in a moment" ;;
        running:unhealthy) bad "$svc: unhealthy — docker compose logs $svc" ;;
        *)               bad "$svc: state=$state health=$health" ;;
    esac
done

# minio-init is a one-shot job: success = exited(0)
cid="$($DC ps -a -q minio-init 2>/dev/null | head -1)"
if [ -n "$cid" ]; then
    code="$(docker inspect -f '{{.State.ExitCode}}' "$cid" 2>/dev/null)"
    if [ "$code" = "0" ]; then ok "minio-init: bucket bootstrap completed (exit 0)"
    else bad "minio-init: exit code $code — docker compose logs minio-init"; fi
fi

# ── 2. datastores answer real queries ─────────────────────────────────────
printf '\n2. Datastore round-trips\n'
if $DC exec -T mysql sh -c \
    'mysql -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" "$MYSQL_DATABASE"' \
    >/dev/null 2>&1; then
    ok 'MySQL: authenticated SELECT using $MYSQL_DATABASE (container env)'
else
    bad "MySQL: query failed (healthcheck / credentials)"
fi

if [ "$($DC exec -T redis redis-cli ping 2>/dev/null | tr -d '\r')" = "PONG" ]; then
    ok "Redis: PING -> PONG"
else
    bad "Redis: no PONG (check REDIS_PASSWORD)"
fi

# ── 3. MinIO API + console ────────────────────────────────────────────────
printf '\n3. MinIO object storage\n'
if [ "$(http_code "http://localhost:${MINIO_API_PORT}/minio/health/live")" = "200" ]; then
    ok "minio API  http://localhost:${MINIO_API_PORT} (health/live = 200)"
else
    bad "minio API http://localhost:${MINIO_API_PORT} did not return 200"
fi

if [ "$(http_code "http://localhost:${MINIO_CONSOLE_PORT}/")" = "200" ]; then
    ok "minio console reachable at http://localhost:${MINIO_CONSOLE_PORT}"
else
    bad "minio console http://localhost:${MINIO_CONSOLE_PORT} unreachable"
fi

if [ "$(http_code "http://localhost:${MINIO_API_PORT}/${MINIO_BUCKET}/")" = "200" ]; then
    ok "bucket '${MINIO_BUCKET}' is publicly listable (anonymous read enabled)"
else
    info "bucket '${MINIO_BUCKET}' did not list publicly (expected if policy=none)"
fi

# ── 4. nginx -> php-fpm ───────────────────────────────────────────────────
printf '\n4. Laravel behind nginx\n'
if [ "$(http_code "http://localhost:${NGINX_PORT}/health")" = "200" ]; then
    ok "nginx       http://localhost:${NGINX_PORT}/health = 200"
else
    bad "nginx       http://localhost:${NGINX_PORT}/health failed"
fi

up="$(http_code "http://localhost:${NGINX_PORT}/up")"
if [ "$up" = "200" ]; then
    ok "Laravel     http://localhost:${NGINX_PORT}/up = 200 (php-fpm answered)"
elif [ "$up" = "404" ]; then
    info "Laravel /up = 404 — app not scaffolded yet:"
    info "  docker compose --env-file $ENV_FILE exec laravel.app bootstrap-laravel.sh"
else
    bad "Laravel via nginx returned HTTP ${up} (502 = php-fpm unreachable)"
fi

# The storefront's catalog contract. A 404 here is what made the Next.js home
# page answer 500 ("Failed to load the product catalog"), so it is a hard
# failure: without it there is no storefront, only an error page.
for endpoint in categories products; do
    body="$(curl -s --max-time 6 -H 'Accept: application/json' \
        "http://localhost:${NGINX_PORT}/api/v1/${endpoint}" 2>/dev/null)"
    code="$(http_code "http://localhost:${NGINX_PORT}/api/v1/${endpoint}")"
    case "$code" in
        200)
            case "$body" in
                *'"success":true'*) ok "API         /api/v1/${endpoint} = 200 (JSON envelope)" ;;
                *) bad "API         /api/v1/${endpoint} answered 200 but not the JSON envelope" ;;
            esac
            ;;
        404) bad "API         /api/v1/${endpoint} = 404 — catalog routes are not registered" ;;
        *)   bad "API         /api/v1/${endpoint} returned HTTP ${code}" ;;
    esac
done

# ── 5. Next.js ────────────────────────────────────────────────────────────
printf '\n5. Next.js\n'
if [ "$(http_code "http://localhost:${FRONTEND_PORT}/api/health")" = "200" ]; then
    ok "Next.js     http://localhost:${FRONTEND_PORT}/api/health = 200"
else
    info "Next.js not answering yet — first boot runs npm install (up to ~2 min),"
    info "  watch it with: docker compose --env-file $ENV_FILE logs -f nextjs.app"
fi

# ── 6. internal network resolution ────────────────────────────────────────
printf '\n6. Container-to-container communication\n'
if $DC exec -T laravel.app sh -c \
    'php -r "exit(@fsockopen(\"mysql\",3306)?0:1);" && php -r "exit(@fsockopen(\"redis\",6379)?0:1);"' \
    >/dev/null 2>&1; then
    ok "laravel.app -> mysql:3306 / redis:6379 (DNS + TCP on the toy-store net)"
else
    bad "laravel.app cannot reach mysql/redis by service name"
fi

if $DC exec -T nextjs.app node -e \
    "fetch('http://nginx/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ok "nextjs.app -> http://nginx/health (Next.js server components can call the API internally)"
else
    bad "nextjs.app cannot reach nginx by service name"
fi

if $DC exec -T laravel.app sh -c \
    'php -r "exit(@fsockopen(\"minio\",9000)?0:1);"' >/dev/null 2>&1; then
    ok "laravel.app -> minio:9000 (S3 endpoint reachable)"
else
    bad "laravel.app cannot reach minio:9000"
fi

# ── summary ───────────────────────────────────────────────────────────────
printf -- '\n-------------------------------------------------------------\n'
if [ "$FAILED" -eq 0 ]; then
    printf 'RESULT: all required checks passed.\n'
    printf '\n  Storefront   http://localhost:%s\n' "$FRONTEND_PORT"
    printf '  API          http://localhost:%s\n' "$NGINX_PORT"
    printf '  MinIO UI     http://localhost:%s\n\n' "$MINIO_CONSOLE_PORT"
    exit 0
fi

printf 'RESULT: failures detected (see [FAIL] above).\n'
printf '  Next steps: docker compose --env-file %s ps\n' "$ENV_FILE"
printf '              docker compose --env-file %s logs --tail=50\n\n' "$ENV_FILE"
exit 1
