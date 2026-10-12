# P6 — Card 3D removal, the 9 mm repair, panel access and direct-IRT pricing

Status: **complete and verified on the running stack** (browser + database +
suites). Companions: [`p5-product-discovery.md`](p5-product-discovery.md),
[`p4-minio-ingest-and-404.md`](p4-minio-ingest-and-404.md),
[`p0-money-contract.md`](p0-money-contract.md).

Four separate problems were fixed, in dependency order: a listing that behaved
like a viewer, a model that silently rendered nothing, an admin panel nobody
could enter, and a price form that could not express "toman, entered by hand".

The catalogue was **not** touched: 14 products, 9 `media3d` rows, 6 categories
and 6 legacy-USD rows before and after, and no GLB or MinIO object was written,
moved or deleted.

---

## 1. A product card is a layout, not a viewer

`ProductCard` mounted a rotating react-three-fiber `<Canvas>` of the product on
hover (`ModelPreview`). Two independent faults came from that one decision:

1. **The canvas is a live, self-sizing element.** r3f writes its own
   `position: relative; width/height: 100%` onto its wrapper and observes it with
   a `ResizeObserver`. Dropped into the card's `aspect-ratio` box, its
   measurement fed back into layout, so hovering a card could grow its height
   without settling — the reported "card expands downwards indefinitely".
2. **It cost real bytes.** A pointer crossing a tile fetched a `.glb` of up to
   21 MB (the Porsches) and booted a WebGL context, per card.

The card is now 2D by construction. Its media box is `aspect-square
overflow-hidden`, the poster is rendered from `media_3d.thumbnail_url` when one
exists, and a product without a picture gets the shared neutral
`MediaPlaceholder` — an inline SVG box plus a Persian label, which fetches
nothing. The hover affordance is limited to `-translate-y`/`shadow`/`opacity`.
3D availability is advertised as a **badge** (`مدل سه‌بعدی دارد`) and reached
through the `مشاهده مدل سه‌بعدی` link, which opens the detail page.

**Owner decision recorded here.** The brief says the 3D viewer should load "only
on the product detail page", while also saying to preserve homepage
functionality. Those conflict for the homepage hero and the category tiles, so
the owner chose the strict reading: both lost their canvases too, and the shared
`ModelPreview` component was deleted so no card can re-import it. The homepage
keeps its featured product, its hero panel (poster or placeholder), its CTA and
its rails; it lost only the inline rotating canvas.

The bear: `🧸` is gone from the card as a fallback (it used to stand in for
*every* product, none of which has a thumbnail). It survives in two places that
are not product imagery — a trust-badge icon beside `🚚`/`🛡️` and the
empty-state icon — which is a mascot, not a lie about a product's picture.

## 2. The 9 mm Blaster Pistol: nothing was wrong with the file

The report was "the 3D model does not load correctly". Everything about the
asset was in order:

| Check | Result |
| --- | --- |
| Product row | `id 7`, slug `9mm-blaster-pistol`, category `blasters` (6) |
| `media3d` row | `id 2` → product 7, `original_file_url = models/9_mm.glb`, no optimized |
| Object exists in MinIO | yes, `5454796` bytes |
| Browser-facing URL | `http://localhost:9000/toy-store-assets/models/9_mm.glb` |
| Internal hostname leak | none (`localhost:9000` is the published endpoint) |
| Content type | `model/gltf-binary` |
| Bytes vs the repo fixture | **sha256 identical** |
| GLB validity | `glTF` v2, 8 meshes, 2 materials, 6 embedded PNGs, no external URIs |
| Extensions | `KHR_materials_emissive_strength`, `KHR_materials_specular` — both natively supported |
| Browser console / network | no error; the `.glb` returned **200** and every texture decoded |

…and yet the canvas was **empty**. The cause was the *viewer's camera*, not the
model. react-three-fiber builds its default camera as
`PerspectiveCamera(75, 0, 0.1, 1000)` — a far plane of exactly `1000` — and
`ProductViewer3D` passed only `position`/`fov`, so `far` stayed `1000`.

That is survivable for every other asset in the catalogue, whose measured radii
are `0.14 … 3.12` world units. It is fatal for this one, because its geometry is
authored at **~1000× the scale of everything else**:

| Model | Real bounding size (node transforms applied) | Radius |
| --- | --- | --- |
| `ford_mustang_1965` | 0.77 × 0.60 × 1.92 | 0.96 |
| `duck` / `duck_opt` | 1.66 × 1.54 × 1.15 | 0.83 |
| `porsche_911_carrera_4s` | 2.75 × 1.26 × 5.15 | 2.58 |
| `9_mm` | **2090 × 204 × 2053** | **1045.18** |

Framing a sphere of radius 1045 needs the camera ~3240 units out, which puts the
model's surface 2195…4285 units away — entirely beyond a far plane of 1000. The
GPU clipped all of it, so the canvas rendered nothing and reported no error at
all. Every symptom was consistent with "the model is broken"; nothing was.

**The repair is in the viewer, not the asset** (modifying the GLB or its MinIO
object was not authorized and was not needed):

- `viewerFraming(radius)` in `CameraRig.tsx` derives the preset distance, the
  `OrbitControls` zoom bounds **and** the clip range from one measured radius:
  `near = max(minDistance − 1.2r, 0.01r, 0.001)`, `far = maxDistance + 2r`.
  The range always contains the model and the whole zoom span.
- `ProductViewer3D` now renders `<PerspectiveCamera makeDefault near far />`
  instead of passing a `camera` prop. This matters: r3f *recreates* the camera
  when the `camera` prop changes (leaving `OrbitControls` and `CameraRig`
  pointing at a stale instance), whereas props on the camera element are updated
  in place, and drei's `PerspectiveCamera` refreshes the projection matrix on
  every commit. The same `viewerFraming` feeds the controls, so the two can no
  longer drift apart.

Verified after the change: the 9 mm renders, `classic-rubber-duck` (Draco-optimised,
radius 0.83) and `colt-python-revolver` (radius 0.145) are unchanged, and the
detail pages still fetch their model from MinIO with no console error.

### One honest residual

The 9 mm asset contains a `Plane001_Plane_0` mesh of **2090 × 0 × 2053** units —
a flat backdrop/ground plane — while the pistol's own parts span only
~105 × 202 × 234 around their centre. Because the pivot of that plane sits near
the origin, the union bounds are ~20× the gun, so the whole scene is fitted and
the pistol occupies a modest part of the frame. That is the *correct* generic
outcome: any camera that contains a 2090-unit plane must stand back from it.
Making the pistol fill the frame means dropping that plane from the asset, which
is an asset change (not authorized here) — not a viewer heuristic to invent.
Also note the plane's `Y` extent is `0.0`: it is degenerate, so it resolves to a
line rather than a surface.

## 3. The admin panel could not be entered at all

`/admin` is a Filament panel and its login page authenticates an **email +
password** pair. The `users` table had neither column — the project is
deliberately passwordless ("the Iranian mobile number IS the credential") — so:

```
Auth::attempt(['email' => …, 'password' => …])
→ SQLSTATE[42S22]: Column not found: 1054 Unknown column 'email' in 'where clause'
```

Nobody could enter the panel, which made every admin-side rule in this phase
unenforceable. With the owner's explicit approval (this is an authentication
surface, which the brief otherwise forbids touching), the fix is one **additive,
reversible** migration —
`2026_10_12_000001_add_panel_credentials_to_users_table.php` — adding three
nullable columns:

| Column | Why |
| --- | --- |
| `email` (nullable, unique) | the panel's username field; `NULL` for every customer |
| `password` (nullable, hashed) | the `hashed` cast stores bcrypt; never read by OTP auth |
| `remember_token` (nullable) | required by the session guard if "remember me" is ticked |

`User::$hidden` now contains both secrets so they can never enter an API payload,
and access is still gated by `canAccessPanel()` — holding a password is not what
grants entry, an `admin` role is. The storefront's OTP/Sanctum flow, the API and
the cart/checkout are untouched; the full suite (including the auth tests) passes.

This migration was applied to the local development database **alone**, after a
`mysqldump` backup (`backups/pre-p6-panel-credentials.sql`), and via
`migrate --path=…` so the money-consolidation migration could not be dragged
along. `2026_10_03_000001` was already `Ran`.

## 4. Pricing: one number, typed by a human, in toman

The money contract in [`p0-money-contract.md`](p0-money-contract.md) already says
the shop sells in `IRT` (integer toman, no subunit) and that a non-IRT amount is
never a price. This phase makes the **entry** path enforce it:

| Rule | Enforced by |
| --- | --- |
| The admin types the final price directly | `TextInput` labelled **`قیمت نهایی به تومان`** |
| Integer only, never rounded | `->integer()` + `IrtAmount` rule + `Money::fromInput()` (throws) |
| Non-negative | `->minValue(0)` |
| A saleable product cannot be saved without an amount | `->required()` |
| Cannot be a dollar price | currency `Select` offers `IRT` **and** now carries `->rule('in:IRT')` |
| No conversion anywhere | there is no rate code to call (pinned by test) |
| Legacy amounts stay quarantined | `legacy_*` columns, surface left alone |

The `in` rule is not belt-and-braces: a Filament `Select` renders its options but
does **not** reject a value outside them, so before it a crafted request could
still post `currency=USD`. A regression test failed for exactly that reason and
then passed once the rule was added — the bug was real, and the test found it.

`IrtPriceEntryTest` (11 tests, 84 assertions) locks the contract in:
typed amounts are stored and served verbatim (`0`, `100`, `2_500_000`,
`12_990_000` — each chosen so a ×10/×100/×1000/×100000 rate would be visible), a
source scan fails if any exchange-rate machinery appears in `app/` or `config/`,
a USD row can never become sellable, decimals and blanks are refused by the real
Filament create form, a USD currency submission is refused, an administrator can
log in and a customer cannot, the password is stored hashed and never
serialised, and a legacy USD row is byte-identical after a toman product is
created through the panel.

---

## 5. راهنمای فارسی پنل مدیریت (Filament)

> همه‌ی مقادیر زیر مربوط به محیط توسعه‌ی محلی است. هیچ رمز واقعی تولیدی در این
> سند نوشته نشده است.

### ۱. آدرس پنل

| چه چیزی | مقدار |
| --- | --- |
| آدرس پنل | `http://localhost:8000/admin` |
| صفحه‌ی ورود | `http://localhost:8000/admin/login` |
| فهرست محصولات | `http://localhost:8000/admin/products` |
| ساخت محصول | `http://localhost:8000/admin/products/create` |

پنل از طریق nginx منتشر می‌شود؛ پورت `8000` در `docker-compose.yml` به کانتینر
nginx نگاشت شده است. آدرس، شناسه‌ی پنل (`admin`) و مسیر آن (`admin`) از
`app/Providers/Filament/AdminPanelProvider.php` خوانده شده است — حدس زده نشده.

### ۲. دستورهای لازم

```bash
# اگر سرویس‌ها بالا نیستند:
docker compose up -d

# اجرای مایگریشن‌ها (فقط در صورت نیاز؛ برای این فاز قبلاً اجرا شده است):
docker exec toy-store-laravel.app-1 php artisan migrate --force
```

وضعیت اجرا:

```bash
docker exec toy-store-laravel.app-1 php artisan migrate:status
```

### ۳. ورود: منبع اعتبارنامه

مدیرِ توسعه با `DatabaseSeeder` ساخته می‌شود:

| | |
| --- | --- |
| ایمیل | `admin@toy-store.local` |
| رمز عبور | `password` |
| شماره موبایل | `09120000000` |
| نقش | `admin` |

اگر رکورد مدیر از قبل وجود دارد (مثل دیتابیس فعلی توسعه) و رمز عبورش تنظیم
نشده است، با این دستور امن رمز پنل را تنظیم کنید. ست‌کردن `password` از طریق
cast `hashed` به‌صورت bcrypt ذخیره می‌شود؛ متن خام در دیتابیس نوشته نمی‌شود:

```bash
docker exec toy-store-laravel.app-1 php artisan tinker --execute='
$u = App\Models\User::where("phone", "09120000000")->firstOrFail();
$u->email = "admin@toy-store.local";
$u->password = "password";
$u->save();
echo "ok: {$u->email}\n";
'
```

برای بررسی اینکه ورود کار می‌کند (بدون مرورگر):

```bash
docker exec toy-store-laravel.app-1 php artisan tinker --execute='
var_dump(auth()->attempt(["email" => "admin@toy-store.local", "password" => "password"]));
'
# انتظار: bool(true)
```

> نکته‌ی امنیتی: رمز `password` فقط برای توسعه‌ی محلی است. در محیط واقعی حتماً
> رمز دیگری تنظیم کنید و آن را در سند یا چت قرار ندهید.

### ۴. باز کردن منابع محصولات

پس از ورود، در نوار کناری گروه **Shop** → **Products**
(`http://localhost:8000/admin/products`). ستون‌ها: عنوان، SKU، دسته‌بندی، قیمت،
واحد پول، موجودی، انتشار، «۳D Asset»، وضعیت Draco.

قیمت محصولات قدیمی دلاری در همین جدول «نامشخص — قیمت قدیمی» و واحد پولشان
`USD` نمایش داده می‌شود؛ این عمدی است تا مشخص باشد کدام رکوردها هنوز به تومان
نهایی نشده‌اند.

### ۵. ساخت یک محصول آزمایشی

1. **Products** → دکمه‌ی **New product**.
2. فیلدهای اجباری (با ستاره مشخص شده‌اند):

| فیلد | توضیح |
| --- | --- |
| **Title*** | عنوان محصول |
| **Slug*** | یکتا؛ با ترک‌کردن فیلد عنوان خودکار پر می‌شود |
| **قیمت نهایی به تومان*** | عدد صحیح و نامنفی. باید وارد شود |
| **Currency*** | فقط `IRT — تومان` قابل انتخاب است |
| **Stock*** | عدد صحیح، پیش‌فرض ۰ |
| **Lighting Preset*** | در بخش مدل سه‌بعدی، پیش‌فرض `Studio` |

3. **قیمت نهایی به تومان** را همان عددی وارد کنید که باید فروخته شود (مثلاً
   `2500000` یعنی ۲٬۵۰۰٬۰۰۰ تومان). هیچ نرخ ارز و تبدیلی در کار نیست: همین عدد
   ذخیره و همان عدد به فروشگاه و سبد خرید داده می‌شود.
4. دسته‌بندی: فیلد **Category** را باز کنید و یکی از دسته‌های موجود را انتخاب
   کنید (`model-cars`، `blasters`، `bath-toys`، …). اگر چیزی انتخاب نکنید،
   محصول روی صفحه‌ی «همه محصولات» دیده می‌شود اما برچسب «بدون دسته‌بندی»
   می‌گیرد.
5. پیوست مدل سه‌بعدی (اختیاری): در بخش **3D Model & Interactive Viewer** فایل
   `.glb`/`.gltf` را در **3D Model File** رها کنید؛ فایل به MinIO منتقل می‌شود و
   کار بهینه‌سازی Draco در صف قرار می‌گیرد (وضعیت در ستون **Draco** دیده
   می‌شود). اگر می‌خواهید فقط یک دارایی موجود را وصل کنید، مسیر کلید شیء را در
   همان فیلد وارد کنید؛ **کلید شیءهای فعلی MinIO را تغییر ندهید.**
6. **Create** را بزنید.

### ۶. پیش‌نمایش محصول

- صفحه‌ی محصول در فروشگاه: `http://localhost:3000/products/<slug>`
- فهرست کامل: `http://localhost:3000/products`
- اگر محصول مدل سه‌بعدی دارد، نماینده‌ی سه‌بعدی فقط در همین صفحه‌ی محصول
  بارگذاری می‌شود (در فهرست و کارت‌ها هیچ canvas ای ساخته نمی‌شود).

### ۷. حذف محصول آزمایشی

1. **Products** → ردیف محصول آزمایشی → **Delete** (یا انتخاب چند ردیف و
   **Delete selected**).
2. تأیید کنید. با این کار رکورد `media3d` مربوطه نیز حذف می‌شود.
3. بررسی کنید که تعداد محصولات به ۱۴ برگشته باشد:

```bash
docker exec toy-store-mysql-1 sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B toy_store_db \
  -e "SELECT COUNT(*) FROM products; SELECT COUNT(*) FROM media3d"'
# انتظار: 14 و 9
```

### ۸. دیدن پیام‌های خطای اعتبارسنجی

اگر ذخیره نشد، بالای فرم یک خلاصه‌ی خطا ظاهر می‌شود و پیام زیر همان فیلد
نوشته می‌شود. خطاهای رایج قیمت:

| پیام | معنا |
| --- | --- |
| «مبلغ باید یک عدد صحیح و نامنفی به تومان باشد.» | عدد اعشاری یا نامعتبر وارد شده |
| «The price field is required.» | قیمت خالی است و محصول قابل فروش نمی‌شود |
| «The selected currency is invalid.» | واحد پول غیر از `IRT` ارسال شده است |

---

## 6. Verification, as run

| Check | Result |
| --- | --- |
| `php vendor/bin/phpunit --do-not-cache-result` | **OK — 184 tests, 1140 assertions** (was 173/1056; `IrtPriceEntryTest` adds 11/84) |
| `tsc --noEmit --incremental false` | exit `0` |
| `node --test` | **19/19 pass** (was 14; `productCardInvariants` adds 5) |
| `eslint` on changed files | only the 2 pre-existing `react-hooks/set-state-in-effect` errors in `ProductViewer3D.tsx`, **proven identical at `HEAD`** by linting `git show HEAD:…` |
| `/products` in Chromium | 14 `<article>`, **0 `<canvas>`**, **0 `.glb` requests**, 14 neutral placeholders, heights 419–443 px |
| Hover on a card | heights change by **0 px**, still 0 canvases |
| Click a card's model link | navigates to `/products/halo-smg-blaster`, `<h1>` matches, **1 canvas** mounts and the `.glb` is fetched |
| Mobile viewport 390 × 844 | 14 cards at a uniform **537 px**, media boxes square within 2 px, 0 canvases, heights and `scrollHeight` unchanged after pointer/touch events |
| Homepage | 0 canvases, 0 `.glb` requests, hero renders the placeholder |
| 9 mm detail page | model renders; `.glb` 200; no uncaught console error |
| Duck (Draco) / Colt (tiny) detail pages | both render correctly — no camera regression |
| Public catalog API | 14 products, 9 with media; hosts `localhost:9000` + `raw.githubusercontent.com`; **0** occurrences of `minio:9000` |
| Panel login (real browser) | `http://localhost:8000/admin/login` → Dashboard; Products list shows 14 rows; create form shows `قیمت نهایی به تومان*` and a currency select whose only option is `IRT` |
| Product created through the real form | typed `2500000` → stored `2500000`, `IRT`; API returns `price: 2500000`, `purchasable: true`, `legacy_price: null` |
| Temporary product removed | products 14, `media3d` 9, categories 6, legacy-USD 6, probes 0 |
| Legacy money | all six rows unchanged: `price NULL`, `currency USD`, `legacy_price` 12.99 / 18.50 / 64.00 / 48.25 / 129.00 / 189.99, `updated_at` untouched |
| MinIO integrity | all 9 `original_file_url` keys unchanged; every object resolves with `model/gltf-binary`; 9 mm still sha256-identical to the repo fixture |

Two notes on that table. `media3d.file_size` for the duck row (`42752`) differs
from `duck.glb` (`120484`) because that column records the **optimized** size
(`duck_opt.glb`), a pre-existing convention. And the browser-driven create
revealed that Filament also inserts an empty `media3d` child row when the viewer
section has defaults — the probe's child row was removed along with it.

## 7. What this phase did not change

- No product deleted, none duplicated, no id or slug changed (the only new row
  was the temporary probe, removed and re-verified).
- No legacy USD value converted, re-labelled or recalculated; no rate invented.
- No GLB file or MinIO object modified, moved or deleted; no re-ingestion and no
  optimizer run.
- No cart, checkout, order or storefront-auth logic touched.
- The product detail page keeps its viewer and its `ProductViewer3D`.
- 404 behaviour for unknown product/category slugs is unchanged.
- `CatalogSeeder` still writes toman prices for its demo slugs (pre-existing, not
  run here).

### Residual limitations

1. **9 mm framing.** The asset's 2090-unit backdrop plane means the pistol does
   not fill the frame. Fixing that means editing the asset (dropping
   `Plane001_Plane_0`) — an asset change, deliberately not taken.
2. **Component behaviour is not covered in CI.** This project has no DOM test
   harness, so the card invariants are asserted structurally against the
   component sources and behaviourally in the browser; a future refactor could
   still mount a canvas without those source assertions failing *if* it avoided
   the forbidden import specifiers (unlikely, but not impossible).
3. **The panel password is development-only.** `password` / `admin@toy-store.local`
   exist on the local database. A real deployment must set its own.
4. **`/admin/login` still offers "remember me"**, which now works because the
   column exists; nothing depends on it.
