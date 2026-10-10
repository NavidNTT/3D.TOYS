# P2 — 3D asset ingestion, media mapping, clean product naming

Status: **ingestion complete and verified.** The ten local GLB fixtures now live in
the canonical MinIO bucket and are mapped to eight catalogue products. One step
still needs an explicit approval (restarting the Next.js container; see
[Still outstanding](#still-outstanding)).

Companion documents: [`p1a-minio-catalog.md`](p1a-minio-catalog.md) (storage
foundation + public `/products` page) and `p0-money-contract.md` (currency).

---

## 1. What was delivered

| Fixture (in `frontend/public/models/draco-check/`) | Clean product title | Product slug | Object key(s) |
| --- | --- | --- | --- |
| `9_mm.glb` | 9mm Blaster Pistol | `9mm-blaster-pistol` | `models/9_mm.glb` |
| `ak-47.glb` | AK-47 Blaster Rifle | `ak-47-blaster-rifle` | `models/ak-47.glb` |
| `duck.glb` | Classic Rubber Duck | `classic-rubber-duck` | `models/duck.glb` |
| `duck_opt.glb` | *(same product — the Draco-compressed rendition)* | `classic-rubber-duck` | `models/duck_opt.glb` |
| `ford_mustang_1965.glb` | Ford Mustang 1965 Model Car | `ford-mustang-1965` | `models/ford_mustang_1965.glb` |
| `free_1975_porsche_911_930_turbo.glb` | Porsche 911 Turbo 1975 Model Car | `porsche-911-turbo-1975` | `models/free_1975_porsche_911_930_turbo.glb` |
| `free_porsche_911_carrera_4s.glb` | Porsche 911 Carrera 4S Model Car | `porsche-911-carrera-4s` | `models/free_porsche_911_carrera_4s.glb` |
| `gameready_colt_python_revolver.glb` | Colt Python Revolver Model | `colt-python-revolver` | `models/gameready_colt_python_revolver.glb` |
| `gameready_colt_python_revolver (1).glb` | *(same product — byte-identical duplicate)* | `colt-python-revolver` | `models/gameready_colt_python_revolver_1.glb` |
| `halo_2_anniversary_-_smg.glb` | Halo SMG Blaster | `halo-smg-blaster` | `models/halo_2_anniversary_-_smg.glb` |

Ten fixture files → **ten stored objects** → **eight products**. Two files are
not standalone assets:

* `duck_opt.glb` is the Draco-compressed output of `duck.glb` (120,484 → 42,752
  bytes). It is recorded as that product's `optimized_file_url`, which is what
  the viewer streams (`Media3DResource::urlFor` prefers it) and what `file_size`
  reports.
* `gameready_colt_python_revolver (1).glb` has the same SHA-256 as its sibling.
  Both are preserved and uploaded under distinct keys; the product maps to the
  first. The command verifies the duplicate really is byte-identical and fails if
  two files claiming to be one asset differ.

### Integrity

Every object was hashed **before upload and again by reading the object back
through the storage disk**; the run fails on any mismatch. Independently, all ten
objects were fetched from the browser-facing endpoint and hashed there:

```
models/9_mm.glb                                http=200 type=model/gltf-binary hash=MATCH
models/ak-47.glb                               http=200 type=model/gltf-binary hash=MATCH
models/duck.glb                                http=200 type=model/gltf-binary hash=MATCH
models/duck_opt.glb                            http=200 type=model/gltf-binary hash=MATCH
models/ford_mustang_1965.glb                   http=200 type=model/gltf-binary hash=MATCH
models/free_1975_porsche_911_930_turbo.glb     http=200 type=model/gltf-binary hash=MATCH
models/free_porsche_911_carrera_4s.glb         http=200 type=model/gltf-binary hash=MATCH
models/gameready_colt_python_revolver.glb      http=200 type=model/gltf-binary hash=MATCH
models/gameready_colt_python_revolver_1.glb    http=200 type=model/gltf-binary hash=MATCH
models/halo_2_anniversary_-_smg.glb            http=200 type=model/gltf-binary hash=MATCH
```

The source files were hashed again after the run and are unchanged: the run only
ever reads them.

### What was *not* touched

* The six legacy USD rows (ids 1–6): still `price = NULL`, `currency = USD`,
  originals preserved in `legacy_*`, still unpurchasable.
* `media3d` row 1 (product 1's external Khronos demo URL): preserved verbatim.
  P1-A's rule "do not rewrite external URLs" still holds, so the local duck
  fixture became a *new* product rather than overwriting that demo fixture.
* Nothing in `frontend/public/models/` was moved, renamed, optimised, deduped or
  deleted.
* No migration ran (the live schema is still at `2026_10_03_000001`).
* No price was invented. Every new row is `price = NULL` with currency `IRT`,
  i.e. published but unpurchasable — the same honest state the storefront renders
  as «قیمت در حال بررسی» / «قیمت نامشخص».

---

## 2. The mechanism: `php artisan toys:ingest-3d`

`app/Console/Commands/Ingest3DModelsCommand.php`, fed by the manifest in
`config/media_ingest.php` (data, not code — titles and keys are editable without
touching the command, and a test can override the entries).

```
php artisan toys:ingest-3d [--source=<dir>] [--disk=<name>] [--dry-run]
```

Properties that matter:

* **Idempotent.** Products match on their unique `slug`, media rows on
  `product_id`; re-running uploads the same keys and updates the same rows.
* **Verifiable.** Upload → read back → SHA-256 compare. `--dry-run` validates the
  fixtures (glTF magic, container version, declared length == file size) and
  prints the plan without uploading or writing.
* **Accountable.** Every `.glb` in the source directory must be listed in the
  manifest; an unlisted file aborts the run rather than being silently skipped.
* **Quiet about Draco.** Media rows are written with `withoutEvents()`, the same
  reasoning the catalogue seeder documents: `ProductMedia3DObserver` would queue
  `Optimize3DModelJob`, which reads the file from the *local* ingest disk — these
  fixtures are already optimised and are not on that disk, so the job could only
  fail and pollute `failed_jobs`. Confirmed after the run: `failed_jobs = 0`,
  `jobs = 0`.

The Docker layout mounts only `backend/` into the app container, so the fixtures
were staged read-only and handed over explicitly:

```bash
docker cp frontend/public/models/draco-check/. toy-store-laravel.app-1:/tmp/models-ingest/
docker exec toy-store-laravel.app-1 php artisan toys:ingest-3d --source=/tmp/models-ingest
```

At this phase `MEDIA_INGEST_DISK` still stayed `public`: the admin-panel upload
path needed a real filesystem path for the Draco CLI. This command nevertheless
wrote straight to the canonical disk, so the fixtures were on MinIO while admin
uploads stayed local. **That gap is now closed** — the optimizer streams through
private temp files and `MEDIA_INGEST_DISK` defaults to `s3`, so uploads land in
MinIO too. See [`p4-minio-ingest-and-404.md`](p4-minio-ingest-and-404.md).

---

## 3. Verification performed

| Check | Result |
| --- | --- |
| Fixture count/size/hash inventory (host) | 10 files, all `glTF` v2 with declared length == file size |
| `docker cp` transfer integrity | all 10 SHA-256 values identical inside the container |
| Upload round-trip hash (via the S3 disk) | 10/10 matched, else the run fails |
| Browser-facing GET of every object | 10/10 `200`, `model/gltf-binary`, hash matched |
| API `GET /api/v1/products` | `total = 14`, `purchasable = 0`, zero `minio:9000` leaks |
| API `GET /api/v1/products/classic-rubber-duck` | `price = null`, `currency = IRT`, `purchasable = false`, `media_3d.url` = MinIO `duck_opt.glb`, `file_size = 42752` |
| `/products` page (Next, live) | renders, 14 unpriced states |
| `/products/[slug]` 3D viewer | MinIO object fetched (`duck_opt.glb` → 200), Draco decoder loaded, model rendered (screenshot) |
| `php vendor/bin/phpunit --do-not-cache-result` | **159 tests, 934 assertions, OK** |
| `tsc --noEmit --incremental false` | exit 0 |
| `node --test tests/*.test.ts` (frontend) | 10/10 pass |
| ESLint on changed frontend files | clean (the two `react-hooks/set-state-in-effect` errors in `ProductViewer3D.tsx` are pre-existing — they exist in the committed file) |

---

## 4. The MinIO container was recreated (approved)

The live `toy-store-minio-1` container had been created before the current
Compose port/console configuration. After the host restart it was attached to
**no** Docker network and published **no** ports, so:

* Laravel could not resolve host `minio`, and the first ingest attempt failed
  loudly (`cURL error 6: Could not resolve host: minio`) — the `throw => true`
  disk behaving exactly as designed, instead of silently falling back to local
  storage; and
* `http://localhost:9000/…` was unreachable from a browser.

With approval, only that service was recreated:

```bash
docker compose --env-file .env.docker up -d --no-deps --pull never minio
```

The named volume `toy-store_minio_data` was preserved, every other container was
left running (only the `minio` container ID changed), and it came back healthy
with `9000 → 9000` and `9001 → 9002` (the console port `.env.docker` declares)
and the network alias `minio`.

---

## Still outstanding

**The Next.js container still serves a bundle built before these edits.** The
frontend is bind-mounted, but this Windows mount does not reliably trigger
recompiles for new/changed files, so `localhost:3000` currently serves the
*pre-fix* `ViewerLoader` and the pre-P1-A route manifest. The fix below is
verified on an isolated host dev server instead. Activating it needs:

```bash
docker restart toy-store-nextjs.app-1
```

(Not executed — it restarts a live container and needs explicit approval.)

### Viewer fix included in this pass

`ViewerLoader` was the Suspense fallback for both 3D viewers and wrapped its
markup in drei's `<Html>`, which mounts a second React root inside the canvas
container. With a fast model (a local MinIO object answers in milliseconds) React
tore that root down synchronously while rendering, so the console reported:

> Attempted to synchronously unmount a root while React was already rendering…

It is now ordinary DOM, rendered *over* the canvas (`ProductViewer3D`) instead of
inside it, and the in-canvas Suspense fallbacks are `null`. Differential
evidence, same page (home, whose `FeaturedModelHero` → `ModelPreview` mounts a
canvas immediately):

| Bundle | Console |
| --- | --- |
| container `:3000` (pre-fix) | `uncaught exception` present |
| isolated `:3100` (fixed) | no uncaught exception (only HMR-socket noise from the isolated server) |

### Known pre-existing observations (not changed here)

* `CatalogSeeder` claims its prices are "the same numbers the demo USD catalog
  was converted to", but the live rows are preserved as legacy USD with
  `price = NULL`. The comment is stale; the rows are correct.
* `Optimize3DModelJob` hardcodes `connection = 'redis'`, so `QUEUE_CONNECTION=sync`
  in the test suite cannot contain it: a job dispatched during a test run reaches
  the live worker. Observed once in this session against media row 1 (a remote
  demo URL), which the job skipped without writing anything. Worth fixing, out of
  scope here.
