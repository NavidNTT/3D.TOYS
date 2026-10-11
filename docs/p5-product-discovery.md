# P5 — Product discovery, catalog listing & category assignment

Status: **complete and verified.** All fourteen products are reachable from the
storefront's own navigation; the eight 3D fixtures are no longer URL-only.

Companion documents: [`p4-minio-ingest-and-404.md`](p4-minio-ingest-and-404.md),
[`p3-final-activation.md`](p3-final-activation.md),
[`p2-3d-ingestion.md`](p2-3d-ingestion.md),
[`p1a-minio-catalog.md`](p1a-minio-catalog.md), `p0-money-contract.md`.

---

## 1. Reconnaissance — what was actually missing

The interesting finding is that very little was broken; the products were simply
**unfiled**.

| Question | Finding |
| --- | --- |
| Routes under the products area | `/products` (route group `(catalog)`, with a skeleton in `loading.tsx`), `/products/[slug]` + its `not-found.tsx` |
| Did `/products` exist? | Yes — and it already listed all 14 published products (per_page 24, one page) |
| Category routes | `/categories` and `/categories/[slug]`; filtering went through `GET /api/v1/products?category={slug}` (`whereHas('category', …)`), i.e. backend filtering, not client-side |
| Product API shape | `{success, message, data: {data: […rows], meta, links}}`; each row carries `id, title, slug, description, price, compare_at_price, currency, purchasable, legacy_*, stock, is_active, attributes, category, media_3d` |
| Homepage query | `getProducts({per_page: 8, in_stock: true})` — a **selection**, not the catalog |
| Categories | 4 — `bath-toys` (1), `building-blocks` (2), `collectible-figures` (3), `remote-control` (4) |
| The 8 3D products | **`category_id = NULL` on every single one** (ids 7–14) |
| N+1 | None: `CatalogService` eager-loads `['category', 'media3d']` for both the listing and the detail read, so a page is 3 queries regardless of row count |

So the products existed, rendered, and had working viewers — but the only way to
reach one was a direct URL somebody had to know. There was no link to `/products`
anywhere in the UI, and no category page could list them.

## 2. The all-products page (`/products`)

Repaired and completed in place — no parallel route was created.

- **All published products**, both legacy and 3D, from the canonical API (the
  same `getProducts()` the category and search pages use).
- **Category chips** for every category, from `GET /api/v1/categories` (the same
  endpoint the home page and `/categories` use) — so a visitor can go catalog →
  category without a hardcoded list anywhere.
- A **count line** (`۱۴ محصول`) so the page states its own completeness.
- **Each card** shows the title, a category badge (`بدون دسته‌بندی` when a row
  genuinely has none), a poster or the safe 🧸 placeholder, the `۳D` badge/toggle
  when a model exists, a labelled **`مشاهده مدل سه‌بعدی`** link, the price under
  the existing money contract, and the purchasable/unpurchasable state with the
  add-to-cart button disabled exactly as before.
- **States**: skeleton (`loading.tsx`), empty (with a link to `/categories`), and
  an explicit API-failure card with `role="alert"` — a failing API never renders
  as "no products".
- **Responsive**: 1 / 2 / 4 columns; chips scroll horizontally on mobile.

## 3. The taxonomy and the mapping

Two categories were added, not seven. That is the minimum that keeps a static
1965 Mustang out of *Remote Control* and a blaster off the *Collectible Figures*
shelf:

| # | Category | Slug | Why not an existing shelf |
| --- | --- | --- | --- |
| 5 | Model Cars (3 models) | `model-cars` | `remote-control` describes motorised toys; a detailed static model is neither motorised nor controlled |
| 6 | Blasters (4 models) | `blasters` | nothing in the original four comes close to prop/game blasters |

The four original categories, their **ids** and their slugs are untouched. The
definitions live in one place — `backend/config/catalog.php` — read by the
seeder, by `toys:ingest-3d` and by `toys:assign-categories`, so the taxonomy
cannot drift between a fresh install and the live database.

### Mapping (deterministic, declared on the fixture manifest)

Each entry of `backend/config/media_ingest.php` names its category, so the ingest
command and the backfill command read the *same* mapping:

| Product | Product ID | Category | Category ID | Slug |
| --- | --- | --- | --- | --- |
| 9mm Blaster Pistol | 7 | Blasters | 6 | `blasters` |
| AK-47 Blaster Rifle | 8 | Blasters | 6 | `blasters` |
| Classic Rubber Duck | 9 | Bath Toys | 1 | `bath-toys` |
| Ford Mustang 1965 Model Car | 10 | Model Cars | 5 | `model-cars` |
| Porsche 911 Turbo 1975 Model Car | 11 | Model Cars | 5 | `model-cars` |
| Porsche 911 Carrera 4S Model Car | 12 | Model Cars | 5 | `model-cars` |
| Colt Python Revolver Model | 13 | Blasters | 6 | `blasters` |
| Halo SMG Blaster | 14 | Blasters | 6 | `blasters` |
| *products 1–6 (legacy)* | 1–6 | *unchanged* | 1–4 | *unchanged* |

The rubber duck follows the duck the hand-written catalogue already shelves in
`bath-toys` (`rubber-duck-classic-bath-toy`), rather than opening a category for
one model. Nothing is derived from a file name: "Model Cars" and "Blasters" are
display names, and the URL segment is the slug.

## 4. The data update

```bash
php artisan toys:assign-categories --dry-run   # print state + proposed mapping only
php artisan toys:assign-categories             # apply
```

- Writes **exactly one column**: `category_id`, through the query builder (no
  accessor, cast or observer sees the write). A row already on the right shelf is
  not written at all.
- **Idempotent**: categories match on their unique `slug`, products on theirs, so
  a second run reports `0 row(s) changed; 8 already shelved` and creates no
  duplicate category or product.
- Prints the current state, the proposed mapping and the state after the run, and
  runs its own **audit** over `id, title, slug, price, compare_at_price,
  currency, legacy_price, legacy_compare_at_price, legacy_currency, stock,
  is_active` before/after.
- Products it does not own (the hand-written catalogue) are left exactly where
  they are.

`toys:ingest-3d` now writes the manifest's category too, and **refuses to start**
while an entry names a category the taxonomy does not define — checked before a
single object is uploaded.

### Live result (real database, real MinIO)

| Measure | Before | After |
| --- | --- | --- |
| products | 14 | 14 |
| media3d | 9 | 9 |
| categories | 4 | **6** |
| categorised products | 6 | **14** |
| legacy USD rows | 6 | 6 |

Independent, column-level before/after comparison of the JSON dumps:

```
products before/after: 14 / 14
media3d before/after: 9 / 9
media3d identical: yes
media3d columns identical (ignoring updated_at): yes
objects: 14 → 14
object keys identical: yes
object sizes+mtime identical: yes
pre-existing category ids/slugs/names preserved: yes
category ids after: 1:bath-toys, 2:building-blocks, 3:collectible-figures,
                    4:remote-control, 5:model-cars, 6:blasters
product column drift (category_id/updated_at ignored): none
categorised products: 14 / 14
```

The money contract after the update, verbatim:
`12.99 / 18.50 / 64.00 / 48.25 / 129.00 / 189.99 USD`, `price = NULL`,
`currency = USD` on all six legacy rows; the eight new rows are `IRT` with
`price = NULL` (unpriced, therefore not purchasable).

## 5. Navigation

| Where | Change |
| --- | --- |
| Header (desktop) | `همه محصولات` added directly after `خانه` |
| Footer quick links | `همه محصولات` + `دسته‌بندی‌ها` added — this block is the only navigation a phone sees |
| Home hero | `همه محصولات` is now the **primary** CTA, with `دسته‌بندی‌ها` beside it |
| Home featured rail | A `همه محصولات` link next to the `محصولات ویژه` heading, so the eight featured rows cannot be mistaken for the inventory |
| `/products` | Category chips for every category |

Routes, labels and the two link lists live in `frontend/src/lib/catalog.ts`, so
the header, the footer, the home page, the cards and the tests all agree.

## 6. Verification

| Check | Result |
| --- | --- |
| `php vendor/bin/phpunit --do-not-cache-result` | **OK — 173 tests, 1056 assertions** (was 164 / 954) |
| `tsc --noEmit --incremental false` | exit 0 |
| `node --test` (frontend) | **14/14** (was 10) |
| ESLint on every changed file | exit 0 |
| `GET /products` | 200, **14 cards**, 14 distinct detail hrefs, none missing, 6 category chips, `۱۴ محصول` |
| `GET /categories/model-cars` | 200, exactly the 3 cars |
| `GET /categories/blasters` | 200, exactly the 4 blasters |
| `GET /categories/bath-toys` | 200, 2 legacy bath toys + the classic duck |
| `GET /products/does-not-exist-xyz` | **404** |
| `GET /categories/does-not-exist` | **404** |
| `GET /api/v1/products?category=does-not-exist` | 200, 0 rows — the API is a filter; the page is what 404s |
| All 8 fixture detail pages | 200, each referencing its own object key |
| Money on `/products` | 14 × `قیمت نامشخص`, **0** rendered تومان amounts, **0** rendered `$` amounts, 14 disabled add-to-cart buttons |
| Internal hostname | 0 occurrences of `minio:9000` in any page; every `.glb` served from `http://localhost:9000/…` |
| Browser (Chromium) | `/products` renders all 14 with the header link; a car category shows the 3 cars; a blaster category shows the 4 blasters; clicking a 3D product opens its detail page and the WebGL viewer renders the Mustang, fetched from the browser-facing MinIO URL (200); no console errors |

## 7. Constraints honoured

No product deleted, none duplicated, no legacy price converted or relabelled, no
exchange rate invented, no MinIO object or local `.glb` created, modified or
deleted (object keys, sizes and mtimes byte-identical before/after), no
auth/payment/cart/checkout
code touched, no existing `ProductResource`/API/media contract bypassed, and the
homepage's featured rail still works.

## 8. Known limitation — worth fixing next

`database/seeders/CatalogSeeder.php` still writes **Toman prices** for the six
demo products (`price => 1_299_000`, `currency => 'IRT'`) while the live rows are
preserved legacy-USD rows with `price = NULL`. That divergence predates this
phase, and re-running the seeder against this database would overwrite the
preserved legacy amounts — which is exactly what the money contract forbids. This
phase did not touch it, and **the seeder was deliberately not run**: the taxonomy
it shares now comes from `config/catalog.php`, and the categories were applied
with `toys:assign-categories` instead. Either the seeder should stop inventing
Toman amounts for those six slugs, or it should be documented as a
fresh-install-only tool.

Also unchanged from P4: the optimizer's output is still only checked for being
non-empty, not for being valid glTF.
