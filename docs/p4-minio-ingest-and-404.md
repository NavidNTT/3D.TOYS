# P4 — Admin MinIO pipeline & frontend route tightening

Status: **complete and verified.** Admin uploads now stream into MinIO, and an
unknown product slug returns a true HTTP 404. Both gaps were carried over from the
[P3 sign-off](p3-final-activation.md).

Companion documents: [`p3-final-activation.md`](p3-final-activation.md),
[`p2-3d-ingestion.md`](p2-3d-ingestion.md),
[`p1a-minio-catalog.md`](p1a-minio-catalog.md), `p0-money-contract.md`.

---

## 1. MinIO-first ingestion

The one line that pinned uploads to the local disk was `$disk->path()`, which
only local adapters implement — the Draco CLI needs a real filesystem path, so
the pipeline could not run against object storage.

`App\Jobs\Optimize3DModelJob::handle()` now streams instead:

1. **pull** the object down from the ingest disk into a private `0700` temp
   directory (`sys_get_temp_dir()/3toys-optimize-<id>-<random>`),
2. **run** `gltf-transform optimize <in> <out> --compress draco` between two temp
   files, so the CLI still sees real paths,
3. **push** the result back to the same disk, then read its size back to prove
   what landed, and
4. **delete** the temp directory in a `finally`, so a failure leaks nothing.

`optimized_file_url` is now written as a **bare object key**
(`models/3d/optimized/x_opt.glb`) rather than a `/storage/…` path, which is what
`Media3DResource::publicUrl()` resolves through the canonical MinIO disk — and it
matches the keys `toys:ingest-3d` already writes. The legacy `/storage/…` branch
stays in the resource for older rows.

Wiring:

| Where | Change |
| --- | --- |
| `config/media.php` | `media.ingest_disk` defaults to the canonical disk |
| `MediaStorage::ingestDisk()` | falls back to `canonicalDisk()` when unset/empty |
| `config/filesystems.php` | the MinIO bucket is defined once and exposed as **both** `s3` and `minio` |
| `docker-compose.yml` | `MEDIA_CANONICAL_DISK` / `MEDIA_INGEST_DISK` on both the app and worker env |
| `backend/.env.example` | `MEDIA_INGEST_DISK=s3` |

The disk name is the one loose end worth naming explicitly: this project calls
its MinIO disk **`s3`** (`MEDIA_CANONICAL_DISK=s3`, `Storage::disk('s3')`), while
ingestion is documented as `MEDIA_INGEST_DISK=minio`. Rather than leave that value
broken, the bucket is declared once and registered under both names — so `s3` and
`minio` resolve to the **same** disk, verified live (identical URL, object
resolves) and guarded by a test that asserts the two config entries are equal, so
they cannot drift apart. `MEDIA_INGEST_DISK=minio` was exercised by injecting it
into the container: `ingestDisk=minio`, resolving to `AwsS3V3Adapter`.
| `ProductResource` upload fields | already used `MediaStorage::ingestDisk()`, so they followed automatically |
| `ProductResource` Draco placeholder | no longer calls `public_path()`; measures the original through the disk and degrades to “no saving” if storage blips |

### Live proof (real MinIO, real `gltf-transform` 4.5.1)

A throwaway probe product pointed at a scratch copy of `models/duck.glb`:

```
ingest disk = s3
scratch source copied: models/3d/_verify/probe.glb = 120484 bytes
[Optimize3DModelJob] optimized (Draco) {"disk":"s3","original_bytes":120484,
  "optimized_bytes":42752,"reduction_percent":64.52}
optimized_file_url = 'models/3d/optimized/probe_opt.glb'
object exists = yes ; stored size = 42752 ; sizes agree = yes
viewer url = http://localhost:9000/toy-store-assets/models/3d/optimized/probe_opt.glb
public disk files before = 1 ; after = 1 (unchanged)
tmp scratch dirs left = 0
AFTER products=14 media3d=9
```

Nothing touched the local `public` disk, no scratch directory survived, the
original `models/duck.glb` was only read, and the probe rows plus scratch objects
were removed in a `finally` — the store is back to 14 products / 9 media rows.

## 2. True 404 for unknown slugs

The page already called `notFound()` and `getProductBySlug()` already mapped an
API 404 to `null`; the API itself correctly answered 404. The response was still
**200** because `app/products/loading.tsx` put a Suspense boundary in front of
the route: Next flushed the shell — and committed the status — before the fetch
resolved, so `notFound()` could only inject the 404 UI into an already-started
stream.

The listing's skeleton is worth keeping, so it was scoped to the listing instead
of deleted: the listing page moved into a route group.

```
app/products/
  (catalog)/          ← URL stays /products
    loading.tsx       ← skeleton, now only wraps the listing
    page.tsx
  [slug]/
    page.tsx
    not-found.tsx
```

Result on the primary port:

| URL | Before | After |
| --- | --- | --- |
| `/products` | 200 (14 cards) | 200 (14 cards, skeleton intact) |
| `/products/classic-rubber-duck` | 200 | 200 |
| `/products/does-not-exist-xyz` | **200** + shell | **404** + `این محصول پیدا نشد` |

## 3. Verification

| Check | Command | Result |
| --- | --- | --- |
| PHPUnit | `php vendor/bin/phpunit --do-not-cache-result` | **OK — 164 tests, 954 assertions**, exit 0 (was 159/934) |
| TypeScript | `tsc --noEmit --incremental false` | exit **0** |
| ESLint | `eslint src/app/products/**/*.tsx` | exit 0 |
| Frontend tests | `node --test` | 10/10 |
| Live storefront | `/`, `/products`, 3D details | 200; 14 cards; 0 probe leakage |
| Live API | `/api/v1/products` | 14 rows, 0 price/purchasable violations, 0 internal-host leaks |
| Legacy isolation | rows 1–6 | still `USD`, `price NULL`, amounts `12.99 … 189.99` verbatim |
| Existing media | `media3d` | 9 rows, `models/*.glb` objects unchanged |

New/updated tests: ingest disk is canonical MinIO; ingest disk falls back to the
canonical disk; the `minio` alias is the same disk as the canonical one; the
optimizer's code contains no `->path(` (comments stripped, so the docblock may
still name the old call); a real end-to-end run streams through temp files into
object storage with the CLI's exact bytes and a bare-key URL; and a failed
optimizer records nothing and leaves no temp files.

## 4. Deliberately not done

- `gltf-transform` output is still only checked for being non-empty, not for
  being a well-formed glTF container. The CLI is trusted to produce what it says
  it produced; validating geometry here would need a parser the stack does not
  have.
- The Draco placeholder still cannot show a saving for legacy rows whose
  `original_file_url` is a remote URL — they are not ours to measure.
