# P3 — Final activation, Next.js sync and end-to-end verification

Status: **activated and verified.** The primary Next.js container was restarted,
the storefront now serves the `P1-A` `/products` route and the `P2` viewer fix, and
every layer was smoke-tested against the live stack.

Companion documents: [`p2-3d-ingestion.md`](p2-3d-ingestion.md) (3D ingestion),
[`p1a-minio-catalog.md`](p1a-minio-catalog.md) (storage + catalogue page) and
`p0-money-contract.md` (currency).

---

## 1. Activation and cleanup

| Item | Result |
| --- | --- |
| Temporary dev server on `:3100` | Already gone — Freebuff restarted and cleared it. `netstat` shows **0 listeners** on 3100, and the only `node.exe` left is Adobe Creative Cloud (left untouched). |
| `docker restart toy-store-nextjs.app-1` | Exit 0. Health went `starting → healthy` in ~6 s. |
| Container log after restart | `next dev --hostname 0.0.0.0 --port 3000`, `✓ Ready in 274ms`, `GET /api/health 200`. |
| All 14 containers | Healthy. `toy-store-nextjs.app-1` recompiled from the current source tree. |

The storefront is served **directly on `:3000`** (`next dev`). The nginx on `:8000`
is the Laravel gateway only — it answers `/api/v1/*` and `/admin` and returns 404
for `/products`, which is expected, not a defect.

## 2. Catalogue — `GET :3000/products`

- `200`, 67 KB, **14 product links**, all 14 product titles present.
- Visible text shows `قیمت نامشخص` (price undetermined) and the badge
  `قیمت در حال بررسی` for every card. No numeric price, no USD figure, no
  truncated amount anywhere in the rendered text.
- All **14 "add to cart" buttons are `disabled`** with the Persian tooltip
  `قیمت تومانی این محصول هنوز نهایی نشده است.`
- 8 new products carry the `۳D` badge; the 6 legacy ones show their category.

## 3. Product detail — `GET :3000/products/[slug]`

| Slug | Result |
| --- | --- |
| `classic-rubber-duck` | Canvas mounted 748×748; `duck_opt.glb → 200`; Draco decoder (`draco_wasm_wrapper.js`, `draco_decoder.wasm`) `200`; console **clean**; screenshot confirms the duck renders live from MinIO. |
| `ak-47-blaster-rifle` | Canvas mounted; `ak-47.glb → 200`; console **clean**. |
| `halo-smg-blaster` | Canvas mounted; loader already cleared; `h1` correct. |
| `trail-blazer-4x4` (legacy) | No 3D viewer (correct); shows `تصویری برای این محصول ثبت نشده است.`, `قیمت نامشخص`, `ناموجود`, disabled quantity + add button; no dev-tools error count. |

**The Drei/Suspense unmount bug is gone.** The same render path that used to log
*"Attempted to synchronously unmount a root while React was already rendering"* on
every 3D detail page now produces no console error at all. No `minio:9000`
internal-host leak appears in any page body.

## 4. Admin

- `/admin → 302 → /admin/login → 200`: Filament boots cleanly.
- `ProductResource` list query replayed against the live database
  (`Product::query()->with(['category','media3d'])->get()`): **14 rows**, every
  relation resolves, **no query error**. Product 9 (the duck) is the only record
  with `optimized_file_url` set, matching the P2 ingestion.

## 5. Asset and money integrity

All ten local sources are present and every MinIO object still hashes identically
to its local file (browser-facing URL `http://localhost:9000/...`):

| Fixture | Object key | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `9_mm.glb` | `models/9_mm.glb` | 5,454,796 | `bb30e9c954ec…` |
| `ak-47.glb` | `models/ak-47.glb` | 4,858,380 | `c27ea8158349…` |
| `duck.glb` | `models/duck.glb` | 120,484 | `65bf938f54d6…` |
| `duck_opt.glb` | `models/duck_opt.glb` | 42,752 | `ab6c0576bd9d…` |
| `ford_mustang_1965.glb` | `models/ford_mustang_1965.glb` | 17,459,564 | `0e11108c720a…` |
| `free_1975_porsche_911_930_turbo.glb` | `models/free_1975_porsche_911_930_turbo.glb` | 21,970,656 | `e1d7de07dda7…` |
| `free_porsche_911_carrera_4s.glb` | `models/free_porsche_911_carrera_4s.glb` | 21,076,404 | `80cbbdfc57c0…` |
| `gameready_colt_python_revolver.glb` | `models/gameready_colt_python_revolver.glb` | 3,449,952 | `ad17f6d2505d…` |
| `gameready_colt_python_revolver (1).glb` | `models/gameready_colt_python_revolver_1.glb` | 3,449,952 | `ad17f6d2505d…` |
| `halo_2_anniversary_-_smg.glb` | `models/halo_2_anniversary_-_smg.glb` | 6,083,680 | `a2eaab5dd301…` |

Money contract on the live database:

- 6 legacy rows still `currency = USD` with their original string amounts
  (`12.99`, `18.50`, `64.00`, `48.25`, `129.00`, `189.99`) in `legacy_price`
  and `price = NULL`.
- `price IS NOT NULL` → **0**; fractional prices → **0**; legacy rows
  relabelled `IRT` → **0**; `media3d` rows → **9**; `failed_jobs` / `jobs` → **0**.

## 6. Test suites

| Check | Command | Result |
| --- | --- | --- |
| PHPUnit | `php vendor/bin/phpunit --do-not-cache-result` | **OK — 159 tests, 934 assertions**, exit 0 |
| TypeScript | `tsc --noEmit --incremental false` | exit **0**, no output |
| Frontend tests | `node --test` (in `frontend/`) | **10/10 pass**, exit 0 |

## 7. Git status

Tracked modifications are the approved P0/P1-A/P2 files; untracked additions are
the approved P2 command/support/tests and the `docs/` set. `frontend/package.json`
still carries exactly its pre-existing change (the single `axios` line removed) —
**not reverted**.

## 8. Known limitations

- The viewer's **loading overlay and asset-failure fallback were not caught
  live**: a MinIO object on loopback resolves in a few milliseconds, so the
  Suspense fallback never stays on screen long enough to observe, and the failure
  path would require injecting a broken media row. They are type-checked and
  reviewed, and no fallback-related exception appears in the console.
- An unknown slug (`/products/does-not-exist-xyz`) returns **HTTP 200** with a
  shell page (0 product cards) rather than a 404. Pre-existing routing behaviour,
  outside the P3 scope; noted for a later pass.
