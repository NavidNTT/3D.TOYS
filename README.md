# Toy Store — 3D e-commerce platform

Unified Docker development stack for a high-performance 3D toy store:

| Layer     | Technology                                                                 |
| --------- | -------------------------------------------------------------------------- |
| Backend   | **Laravel 12** (Controller → Service → Repository), PHP 8.3 FPM            |
| Frontend  | **Next.js 14** App Router, TypeScript, Tailwind CSS                        |
| Database  | **MySQL 8.0** (dedicated volume, `toy_store_db`)                           |
| Cache/Queue | **Redis 7** (cache, sessions, queues)                                    |
| Storage   | **MinIO** (S3 API for `.glb` / `.gltf` / texture assets)                   |

Everything runs on one internal bridge network (`toy-store_net`); service-to-service
traffic never leaves the host, and only the ports you need are published.

---

## 1. Architecture

```
                        host (Windows / macOS / Linux)
                                    │
        ┌───────────────┬───────────┴──────────┬──────────────┬───────────────┐
        │ :8090         │ :3000                │ :9000 :9002  │ :3307  :6380  │
        ▼               ▼                      ▼              ▼       ▼
  ┌───────────┐   ┌────────────┐        ┌────────────┐  ┌────────┐ ┌───────┐
  │  nginx    │   │ nextjs.app │        │   minio    │  │ mysql  │ │ redis │
  │  :80      │   │ :3000      │        │ API+console│  │  :3306 │ │ :6379 │
  └─────┬─────┘   └─────┬──────┘        └─────┬──────┘  └───┬────┘ └───┬───┘
        │ fastcgi       │ fetch(            │ S3           │          │
        │               │  http://nginx)    │              │          │
        ▼               │                   ▼              │          │
  ┌─────────────────────┴────────────────────────────┐     │          │
  │  laravel.app (php-fpm) ── laravel.worker (queue)  │─────┴──────────┘
  └───────────────────────────────────────────────────┘
                    toy-store_net (bridge, internal DNS)
```

`minio-init` is a one-shot container that waits for MinIO, creates the
`toy-store-assets` bucket, enables anonymous read and seeds the
`models/ thumbnails/ textures/ avatars/` prefixes.

### Services and endpoints

| Service          | Image                       | Host URL / port                | Purpose                          |
| ---------------- | --------------------------- | ------------------------------ | -------------------------------- |
| `nginx`          | `nginx:1.27-alpine`         | http://localhost:8090          | Reverse proxy for the API        |
| `laravel.app`    | built from `docker/php`     | http://localhost:9090 (FPM)    | Laravel 12 API (php-fpm)         |
| `laravel.worker` | same image                  | —                              | `php artisan queue:work redis`   |
| `mysql`          | `mysql:8.0`                 | `localhost:3307`               | Primary datastore                |
| `redis`          | `redis:7-alpine`            | `localhost:6380`               | Cache, sessions, queues          |
| `minio`          | `quay.io/minio/minio`       | http://localhost:9000 (API)    | S3-compatible object storage     |
|                  |                             | http://localhost:9002 (console)| MinIO web UI                     |
| `nextjs.app`     | `node:22-bookworm-slim`     | http://localhost:3000          | Next.js 14 dev server (HMR)      |

All published ports are configurable in `.env.docker`. The defaults are
deliberately **not** 8080/3306/6379, because those are almost always already
taken on a developer machine.

---

## 2. Quick start

```bash
# 1. Environment (already present in this checkout as .env.docker)
cp .env.example .env.docker
#    then edit passwords/ports if you like — nothing else reads this file
#    (Compose only auto-loads a file named ".env", hence --env-file below)

# 2. Build the PHP image and start everything
docker compose --env-file .env.docker up -d --build

# 3. Install Laravel into ./backend (once, ~2 min: composer create-project,
#    .env generation, APP_KEY, migrations)
docker compose --env-file .env.docker exec laravel.app bootstrap-laravel.sh

# 4. Verify
./verify-stack.sh
```

Open:

* storefront → <http://localhost:3000>
* API → <http://localhost:8090>
* MinIO console → <http://localhost:9002> (`toy_admin` / `toy_admin_secret`)

The first `up` also runs `npm install` inside the frontend container (a few
minutes on Windows); `next dev` prints `✓ Ready` when it is serving.

---

## 3. Verifying the stack

### Automatically

```bash
./verify-stack.sh                       # or: sh verify-stack.sh
COMPOSE_ENV_FILE=.env ./verify-stack.sh # to point at another env file
```

It checks all eight containers, Docker health status, MySQL authentication
with a real query, Redis `PING`, the MinIO API + console + bucket, nginx →
php-fpm → Laravel, the Next.js server, and container-to-container DNS.

### Manually — the three checks from the brief

**1. MySQL and Redis respond to health checks**

```bash
docker compose --env-file .env.docker ps        # look at the "Health" column
# mysql / redis / minio / laravel.app / laravel.worker / nginx / nextjs.app → healthy

# Stronger than a ping: log in as the app user and query the app database.
docker compose --env-file .env.docker exec mysql \
  sh -c 'mysql -h 127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT VERSION(), DATABASE();" "$MYSQL_DATABASE"'

docker compose --env-file .env.docker exec redis redis-cli ping   # → PONG
```

The Redis healthcheck authenticates through `REDISCLI_AUTH`, and MySQL's logs
in as the application user, so a healthy status proves credentials and schema,
not just that the port is open.

**2. MinIO console is accessible**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:9002/         # → 200
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:9000/minio/health/live  # → 200

# bucket created by minio-init
docker compose --env-file .env.docker exec minio mc alias set local http://127.0.0.1:9000 toy_admin toy_admin_secret
docker compose --env-file .env.docker exec minio mc ls local
```

Or open <http://localhost:9002> and log in with `MINIO_ROOT_USER` /
`MINIO_ROOT_PASSWORD` from `.env.docker`.

**3. Laravel and Next.js communicate locally**

```bash
# Host → API
curl -i http://localhost:8090/up                 # → 200 (Laravel 12 health route)

# Container → container, by service name (this is what server components use)
docker compose --env-file .env.docker exec nextjs.app \
  node -e "fetch('http://nginx/health').then(r=>console.log('nginx says', r.status))"

docker compose --env-file .env.docker exec laravel.app \
  php -r 'echo "minio: ", @fsockopen("minio",9000) ? "reachable" : "unreachable", PHP_EOL;'
```

The status page does this for real: `/status` is a server component that
fetches Laravel's `/up` over `http://nginx` and renders **UP/DOWN** for both
services, while the browser-side links use `NEXT_PUBLIC_API_URL`
(`http://localhost:8090/api`). Seeing two green UP badges at
<http://localhost:3000/status> means the whole path works. (It lives at
`/status` because `/` is now the customer-facing storefront.)

---

## 4. Project layout

```
toy-store/
├── backend/                 # Laravel 12 app (bind-mounted to /var/www/html)
├── frontend/                # Next.js 14 App Router + TypeScript + Tailwind
│   └── app/                 #   layout.tsx, page.tsx, globals.css, api/health
├── docker/
│   ├── nginx/default.conf   # proxy, 64M uploads, FastCGI tuning
│   ├── php/
│   │   ├── Dockerfile       # PHP 8.3 FPM + pdo_mysql/redis/gd/zip/pcntl/exif
│   │   ├── php.ini          # 64M uploads, opcache, error logging
│   │   ├── fpm-pool.conf    # pool, FastCGI ping endpoint, clear_env=no
│   │   ├── entrypoint.sh    # idempotent boot: composer install, key, perms
│   │   ├── healthcheck.sh   # FastCGI ping probe
│   │   └── bootstrap-laravel.sh  # one-time Laravel install + .env + migrate
│   └── minio/init-bucket.sh # bucket, policy, prefixes, versioning
├── docker-compose.yml
├── verify-stack.sh          # end-to-end verification
├── .env.example             # template (copy to .env.docker)
└── .env.docker              # your local values (gitignored)
```

---

## 5. Common tasks

```bash
DC="docker compose --env-file .env.docker"

$DC ps                              # status + health
$DC logs -f laravel.worker          # follow one service
$DC exec laravel.app php artisan migrate
$DC exec laravel.app php artisan make:model Toy -mf
$DC exec laravel.app composer require laravel/sanctum
$DC exec nextjs.app npm install three @react-three/fiber
$DC exec nextjs.app sh              # shell in the frontend container
$DC exec mysql sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
$DC exec redis redis-cli --scan --pattern 'toy_store_*'

# rebuild after changing the Dockerfile / php.ini / fpm-pool.conf
$DC build laravel.app && $DC up -d laravel.app laravel.worker

# scale queue workers horizontally (no container_name is pinned, on purpose)
$DC up -d --scale laravel.worker=3 laravel.worker

# stop / nuke data
$DC down                            # keeps named volumes
$DC down -v                         # deletes DB, Redis and MinIO data
```

Uploading a 3D model (bucket is public-read, so the returned URL works in a browser):

```bash
$DC exec laravel.app php artisan tinker --execute='
  Illuminate\Support\Facades\Storage::disk("s3")
    ->put("models/robot.glb", file_get_contents("/var/www/html/public/img/robot.glb"));
'
```

---

## 6. Passwordless authentication API (OTP + Sanctum)

Login is phone number + one-time code. There is no password anywhere in the
system, so there is nothing to leak, brute-force or reset.

| Method | Endpoint                    | Auth   | Purpose                                                                 |
| ------ | --------------------------- | ------ | ----------------------------------------------------------------------- |
| POST   | `/api/v1/auth/otp/send`     | —      | Generate a 5-digit code, store its hash (2 min TTL), send it via the SMS gateway |
| POST   | `/api/v1/auth/otp/verify`   | —      | Exchange the code for a Sanctum bearer token; registers the user on first login |
| GET    | `/api/v1/auth/me`           | Bearer | Current user (`UserResource`)                                           |
| POST   | `/api/v1/auth/logout`       | Bearer | Revoke the token used for this request                                  |

Every response — success or failure — uses the same envelope:

```json
{ "success": true, "message": "کد تأیید با موفقیت ارسال شد.", "data": null }

{ "success": false,
  "message": "دادههای ارسالی معتبر نیست.",
  "data": { "phone": ["شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد."] } }
```

### Try the whole flow

```bash
DC="docker compose --env-file .env.docker"
API=http://localhost:8090/api/v1/auth

# 1. request a code (seeded accounts: 09120000000 admin, 09121111111 customer)
curl -s -X POST $API/otp/send -H 'Accept: application/json' \
  -H 'Content-Type: application/json' -d '{"phone":"09120000000"}'

# 2. read it from the log — the `log` SMS driver is the default in development
$DC logs --no-log-prefix laravel.app | grep 'SMS:log' | tail -1

# 3. exchange it for a token
curl -s -X POST $API/otp/verify -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{"phone":"09120000000","code":"<CODE>"}'

# 4. use the token
curl -s $API/me -H 'Accept: application/json' -H 'Authorization: Bearer <TOKEN>'

# 5. revoke it
curl -s -X POST $API/logout -H 'Accept: application/json' -H 'Authorization: Bearer <TOKEN>'
```

### How the layers fit together

`Request → Controller → Service → Model`, with the SMS provider behind an
interface so it can be swapped without touching business logic:

| Concern | Where |
| --- | --- |
| Validation + Persian messages | `app/Http/Requests/Auth/{OtpRequest,SendOtpRequest,VerifyOtpRequest}.php` |
| HTTP translation only | `app/Http/Controllers/Api/V1/AuthController.php` |
| Generate / hash / verify codes | `app/Services/Auth/OtpService.php` |
| Find-or-register + issue token | `app/Services/Auth/AuthService.php` |
| SMS transport | `app/Services/Sms/Contracts/SmsGatewayInterface.php`, `Drivers/LogSmsGateway.php`, bound in `SmsServiceProvider` from `config/sms.php` (`SMS_GATEWAY`) |
| Unified response envelope | `app/Support/ApiResponse.php` + the renderers in `bootstrap/app.php` |
| Domain failures | `app/Exceptions/{ApiException,InvalidOtpException,SmsDeliveryFailedException}.php` |
| Schema | `users` (id, phone unique 11, name nullable, role enum) + `otp_codes` (phone, hashed code, expires_at) |

Swapping in a real provider is one config entry plus one class:

```php
// config/sms.php
'default' => env('SMS_GATEWAY', 'log'),
'gateways' => [
    'kavenegar' => [
        'driver' => App\Services\Sms\Drivers\KavenegarSmsGateway::class,
        'api_key' => env('KAVENEGAR_API_KEY'),
        'sender' => env('KAVENEGAR_SENDER'),
    ],
],
```

### Security properties

* Codes are stored **bcrypt-hashed** (`Hash::make`); plaintext exists only
  between generation and the gateway call, and never appears in a response.
* **One live challenge per number**: a new request deletes the previous code,
  and a successful verification consumes it — codes are single use.
* Wrong, expired, already-used and never-issued codes all produce the *same*
  422 message, so nothing leaks about whether a code existed.
* Rate limits are keyed on **phone + IP** (neither alone is sufficient):
  `otp-send` = 1 per 2 minutes **and** 5 per hour, `otp-verify` = 10 per minute,
  the whole API = 60 per minute. 429 responses carry `Retry-After`.
* `loginOrRegister` cannot create duplicate accounts (unique index on
  `users.phone`) and always creates customers; admins are seeded or promoted.
* Tokens are named `auth-token`; `logout` revokes only the current token so
  other devices stay signed in.
* Expected failures are `dontReport()`-ed, so a throttled attacker cannot flood
  the application log with stack traces.

### Tests

```bash
$DC exec laravel.app php artisan test     # 53 tests, 262 assertions
```

`tests/Feature/Auth/SendOtpTest.php` · `VerifyOtpTest.php` · `LogoutTest.php`,
plus `tests/Unit/SmsGatewayBindingTest.php` and `TestingEnvironmentTest.php`.
They cover phone validation (bad length, landlines, international format,
Persian digits, whitespace), hashing at rest, the 2-minute expiry, single use,
invalid/expired/foreign codes, registration vs. existing-user login, token
issue and revocation, and every rate-limit branch.

> **Test isolation gotcha.** This stack exports `DB_CONNECTION`, `CACHE_STORE`
> and friends as *real* container environment variables, and Laravel's env
> repository resolves `$_SERVER` before `$_ENV` — where PHPUnit's `<env>`
> entries never write, even with `force="true"`. `tests/TestCase.php` therefore
> forces the testing values into `putenv`, `$_ENV` and `$_SERVER` before the
> application boots, and `TestingEnvironmentTest` asserts the suite is on
> in-memory SQLite. Without it the suite would silently run against MySQL and
> `RefreshDatabase` would wipe the development database.

### Housekeeping

`OtpService::purgeExpired()` removes stale rows. The scheduler service is not
part of the dev stack yet; add a `laravel.scheduler` service (or a host cron)
running `php artisan schedule:work` when you want it automated:

```php
// routes/console.php
Schedule::call(fn () => app(App\Services\Auth\OtpService::class)->purgeExpired())->hourly();
```

---

## 7. Decisions worth knowing

**Object storage: the MinIO situation.** MinIO removed the `minio/minio` and
`minio/mc` images from Docker Hub on 2026-09-11 and archived the GitHub repo, so
this stack pulls them from **quay.io**, which still works and ships the `mc`
binary the healthcheck uses. If quay.io follows, change two variables —
`MINIO_IMAGE` / `MINIO_MC_IMAGE` — to another S3-compatible implementation
(SeaweedFS, Garage, RustFS, or a pinned mirror). Nothing else in the stack
cares which S3 server answers.

**Why the frontend runs on Debian, not Alpine.** Next.js loads a native
SWC/Turbopack binary (`@next/swc-linux-x64-musl`). On this host that binary
traps with `Bus error (core dumped)` under Alpine/musl, which makes `next dev`
exit silently with code 0 immediately after `✓ Starting...` — no error, no
`✓ Ready`. The glibc image (`node:22-bookworm-slim`) starts reliably. Hence
`NODE_IMAGE_TAG=22-bookworm-slim`. The PHP containers stay on Alpine, where
they build and run fine.

**Laravel 12 instead of 11.** Laravel 11 is end-of-life and Composer 2.10
refuses to install any 11.x release because of unpatched security advisories
(`policy.advisories.block`). Set `LARAVEL_VERSION=^11.0` only if you also
disable that policy knowingly.

**Non-default host ports.** `NGINX_PORT=8090`, `MYSQL_PORT=3307`,
`REDIS_PORT=6380`, `PHP_FPM_PORT=9090`. If you already have another stack on
8080/3306/6379/9001 (this machine does — a `3toys-*` project), the stack still
boots without touching it.

**Mount permissions self-heal.** Docker sometimes creates a missing bind-mount
source as `0700 root`. That stops nginx's worker user from traversing
`public/`, which looks like a mysterious `404 File not found.` The Laravel
entrypoint chmods the mount root to `0755` on every boot, and `nginx` waits for
that container to be healthy (`depends_on: service_healthy`), so the order is
guaranteed.

**Windows / Git Bash.** Git Bash rewrites arguments that look like POSIX paths,
so `docker exec ... /some/container/path` can arrive mangled. Prefix such
commands with `MSYS_NO_PATHCONV=1`. `verify-stack.sh` sets it for itself.

**Performance.** `backend/`, `frontend/`, `node_modules` and `.next` cross the
Windows filesystem boundary, so the first Laravel request (~3-4s cold) and the
first `npm install` are slow. `node_modules` and `.next` are on named volumes
to keep that cost off the bind mount. On Linux/macOS everything is markedly
faster. `php.ini` also raises `realpath_cache_size` for the same reason.

---

## 8. Taking this to production

The compose file is a *development* stack. Before real traffic:

1. Multi-stage `Dockerfile` for the frontend (`next build` → `next start`) and
   run `php artisan config:cache route:cache view:cache` at image build time.
2. No bind mounts, no `npm install` at runtime, run containers as non-root.
3. Secrets from a manager (Vault / SSM / Docker secrets), never `.env` files.
4. `opcache.validate_timestamps=0`, real queue supervision (Horizon or
   Supervisor), MySQL as a managed cluster, Redis with persistence + auth TLS.
5. `php artisan migrate --force` as a one-shot deploy job, not on boot.
6. TLS at the edge (Traefik / ALB / Cloudflare), `client_max_body_size`
   matched to your real upload limit — and 3D assets served from MinIO/CDN
   with signed URLs instead of the public-read policy used here.
7. Resource limits per service, healthchecks wired to your orchestrator, and
   log shipping instead of `json-file`.
8. Add `laravel.scheduler` (`php artisan schedule:work`) as a second worker
   role when you need cron-style jobs.

---

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Bind for 0.0.0.0:8090 failed: port is already allocated` | Another stack owns the port. `docker ps --format "{{.Names}}\t{{.Ports}}"` then change `NGINX_PORT` (same for `MINIO_CONSOLE_PORT`, `MYSQL_PORT`, `REDIS_PORT`). |
| `404 File not found.` from nginx, `[crit] stat() ... Permission denied` in `logs nginx` | Mount root not traversable. `docker compose --env-file .env.docker exec laravel.app chmod 755 /var/www/html` (the entrypoint also does this on boot). |
| Laravel `/up` → 404 but nginx `/health` → 200 | Laravel isn't installed yet: run `bootstrap-laravel.sh`. |
| `laravel.worker` logs "idling until composer.json appears" | Expected on a fresh clone — it starts the queue the moment the app is scaffolded. |
| `next dev` prints `✓ Starting...` and exits 0, `docker compose ps` shows restarts | You are running an Alpine Node image. Set `NODE_IMAGE_TAG=22-bookworm-slim` (see §6). |
| Next.js shows `health: starting` for minutes on first boot | `npm install` is running inside the container; watch `logs -f nextjs.app`. |
| Hot reload doesn't trigger | `WATCHPACK_POLLING`/`CHOKIDAR_USEPOLLING` are already set; for brand-new route files give the watcher a moment or `docker compose restart nextjs.app`. |
| Composer fails with "affected by security advisories" | You pinned an EOL Laravel. Use `^12.0`. |
| `413 Request Entity Too Large` on a `.glb` upload | Raise **both** `client_max_body_size` (`docker/nginx/default.conf`) and `upload_max_filesize`/`post_max_size` (`docker/php/php.ini`), then rebuild/restart. |
| MySQL "Access denied" after changing `.env.docker` | The volume was initialised with the old credentials: `docker compose --env-file .env.docker down -v` and start again. |
| Everything is slow on Windows | Expected with bind mounts; move code into a WSL2 path or accept the cold-start cost. |
| `php artisan test` wipes the development database | It must not — see "Test isolation gotcha" in §6. Confirm `TestingEnvironmentTest` passes. |
| OTP never arrives in development | Expected: the default gateway is `log`. Read the code from `docker compose logs laravel.app \| grep 'SMS:log'`. |
| `429` while manually testing OTP | Rate limits are real: 1 send per 2 minutes, 5 per hour per phone + IP. Use another number or flush Redis (`redis-cli -a $REDIS_PASSWORD FLUSHDB`). |

---

## 10. Suggested next steps

1. Scaffold the domain: `Toys`, `Categories`, `Models`(3D assets), `Orders`
   with migrations, repositories and services behind thin controllers.
2. Connect the storefront to the auth API in §6: request/verify the OTP, keep
   the bearer token, and gate the admin areas on `role`.
3. Asset pipeline: upload endpoint with `spatie/laravel-medialibrary` or a
   dedicated `AssetService` writing to the `s3` disk, plus a queued job that
   generates thumbnails/GLB optimisations — the worker is already running.
4. Render models with `@react-three/fiber` + `drei`, streaming `.glb` from
   MinIO through `NEXT_PUBLIC_MINIO_URL`.
5. Add Pest/PHPUnit + Vitest, and run them in CI against this same compose
   stack (`docker compose ... run --rm laravel.app php artisan test`).
