# P1-A — MinIO foundation and the public catalog

Status: **implemented and verified; one infrastructure action still needs approval**
(recreating the `minio` container so its published ports match the compose file —
see §5).

Scope: P1-A only. No database migration, no GLB/asset work (P2), no auth, no payment.

---

## 1. The storage contract

| | |
|---|---|
| Canonical media disk | `s3` — MinIO over the S3 protocol (`config/filesystems.php`) |
| Disk name source | `config/media.php` → `media.canonical_disk` (`MEDIA_CANONICAL_DISK`) |
| Ingestion disk | `s3` (MinIO) → `media.ingest_disk` (`MEDIA_INGEST_DISK`). At the time of *this* phase it was still `public`; that split was closed later — see [`p4-minio-ingest-and-404.md`](p4-minio-ingest-and-404.md) |
| Internal endpoint | `AWS_ENDPOINT` = `http://minio:9000` — used by the containers |
| Browser endpoint | `AWS_URL` = `http://localhost:9000/toy-store-assets` — handed to browsers |
| Bucket | `toy-store-assets`, created by the idempotent `minio-init` one-shot |
| Object policy | anonymous `download` (public read) — required because `<model-viewer>`, `next/image` and the storefront fetch `.glb`/thumbnails directly |
| Failure mode | the canonical disk sets `throw => true`: a broken MinIO raises, it never falls back to local storage |

`App\Support\MediaStorage` is the single place these answers live. It is
deliberately *not* a second URL helper: the existing accessor
`Media3DResource::publicUrl()` was extended instead, so the three stored shapes
keep their meaning:

| Stored value | Resolves to |
|---|---|
| `https://cdn…/x.glb` (external) | returned untouched — no rewrite, no download |
| `/storage/models/3d/x.glb` (legacy local shape) | the local `public` disk URL |
| `models/3d/x.glb` (bare object key) | the canonical MinIO disk URL |

The internal `minio:9000` hostname can therefore never reach browser-facing JSON,
because only `AWS_URL` is used to build URLs (asserted in
`tests/Feature/Storage/MediaStorageTest.php`).

## 2. Why ingestion is a separate switch

`Optimize3DModelJob` shells out to the Draco CLI (`gltf-transform`), which needs a
real filesystem path, and Flysystem only implements `->path()` for local
adapters. Moving uploads to MinIO therefore requires the pipeline to stream the
object through a temp file first — that is P2 (3D ingestion) work, not storage
wiring.

So uploads (Filament `FileUpload`, the optimizer) read one value —
`MediaStorage::ingestDisk()`. **At the time of this phase it still returned
`public`**, and flipping `MEDIA_INGEST_DISK=s3` before the pipeline change would
have failed loudly (`BadMethodCallException` on `->path()`) rather than silently
skipping optimization. That streaming change has since landed, and
`ingestDisk()` now defaults to the canonical MinIO disk — see
[`p4-minio-ingest-and-404.md`](p4-minio-ingest-and-404.md). No object was moved in
this pass: `storage/app/public` was empty before and after it.

## 3. The public catalog page

`frontend/src/app/products/page.tsx` (`/products`), plus
`loading.tsx` for the segment.

- Server-rendered per request (`dynamic = 'force-dynamic'`) from
  `GET /api/v1/products` through the existing `getProducts()` service.
- Reuses `ProductCard`, the currency-aware `Price`, `Pagination`, `EmptyState`
  and the 1/2/4-column responsive grid used by the category and search pages.
- States: **ready** (grid + pagination), **loading** (skeleton grid),
  **empty** (`EmptyState`), **error** (inline `role="alert"` card + retry link —
  an API failure is never rendered as "no products").
- Money contract: a row serialised as `price: null, currency: 'USD',
  purchasable: false` renders `قیمت نامشخص`, shows the «قیمت در حال بررسی»
  badge, and its add-to-cart button is disabled. Nothing on the page converts,
  truncates or relabels an amount.

## 4. Verification performed

```bash
docker exec toy-store-laravel.app-1 php vendor/bin/phpunit --do-not-cache-result   # OK (148 tests, 781 assertions)
cd frontend && ./node_modules/.bin/tsc --noEmit --incremental false                # exit 0
cd frontend && node --test tests/productListingPrice.test.ts                       # 5/5
docker compose --env-file .env.docker config --quiet                               # exit 0
curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/products              # 200 (isolated dev server)
```

The rendered listing contains 6 product links, 6 × `قیمت نامشخص`, 6 ×
`قیمت در حال بررسی`, 6 disabled add-to-cart buttons and **zero** truncated
`۱۲ تومان` strings. The live API still reports the six legacy rows as
`purchasable: false` with `legacy_price` intact.

## 5. Known blocker (needs approval — not executed)

The *running* `toy-store-minio-1` container publishes **no ports**
(`docker port toy-store-minio-1` is empty), although `docker-compose.yml`
declares `9000:9000` and `9002:9001`. The container was created before the
current compose revision, so the host cannot reach `http://localhost:9000` and
browser-facing MinIO URLs would not resolve until it is recreated.

Existing media is unaffected (the live `media3d` row is an external URL), and
nothing in this pass depends on host-published MinIO.

The command that would be required — **not run here**, it recreates a live
container:

```bash
docker compose --env-file .env.docker up -d --no-deps --force-recreate minio
```

The named volume `minio_data` (and therefore every existing object) survives a
recreate; the bucket contents were verified read-only before and after this pass
(only the four `*.keep` prefix markers, unchanged).
