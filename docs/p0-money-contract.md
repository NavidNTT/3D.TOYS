# P0-A — The money contract

Status: **rehearsed end-to-end on a disposable MySQL 8.0.46 (P0-B) — up, guard,
rollback and forced-failure all verified there; the live database has not been
touched and the migration is still not executed on it.**
Scope: P0-A only (price/currency contract, legacy-USD safety, MySQL portability).
Nothing here touches storage, MinIO, the 3D pipeline, the viewer, or `/products`.

---

## 1. The contract

| | |
|---|---|
| Currency code | `IRT` |
| Unit | Iranian toman — one toman is the smallest unit |
| Stored type | integer (`unsignedBigInteger` after the migration) |
| Example | `1299000` means 1,299,000 toman |
| Display | `۱٬۲۹۹٬۰۰۰ تومان` |
| Arithmetic | integer only; no floating point in any money path |
| API | `price`/`compare_at_price` as JSON integers, always alongside `currency` |
| Frontend | `formatPriceFa(value, currency)` — the suffix follows the currency |

The store sells in **one** currency. `USD` is not a second currency the shop
supports; it is a label left on historical rows.

## 2. The bug this contract removes

`(int) 12.99` is `12`. That single cast, applied through a model cast and again
in the API resource, turned a legacy `12.99 USD` row into `12`, which the
storefront then rendered as `۱۲ تومان` — a product shown at twelve toman. The
checkout service had the same cast, so it would have charged the same figure.

The fix is not "round more carefully". It is: **an amount that is not an exact
integer in toman does not exist as a toman amount.** Every layer returns "no
amount" instead of a number, and every consumer fails closed.

## 3. Legacy USD values

The six legacy rows in the development database — `12.99`, `18.50`, `64.00`,
`48.25`, `129.00`, `189.99` USD — are **not** approved for automatic conversion.
No exchange rate is applied anywhere in the codebase. The number `100000` that
appeared in an earlier draft of the migration was an illustrative example and is
now explicitly rejected by a test
(`tests/Unit/MigrationMoneySqlTest.php`).

Until an explicit mapping is approved:

| Rule | Where it is enforced |
|---|---|
| A USD value is never displayed as toman | `formatPriceFa()` — `USD` renders as `$12.99`; the تومان suffix is never applied to it |
| A USD value is never silently cast to an integer | `Money::toAmount()` returns `null` for any non-`IRT` currency |
| A USD product cannot enter an IRT checkout | `OrderService::chargeableUnitPrice()` throws `UnsupportedCurrencyException` (422, `reason: unsupported_currency`) |
| The original value is preserved verbatim | `products.legacy_price`, `legacy_compare_at_price`, `legacy_currency`, `legacy_price_preserved_at` |
| The storefront cannot add it to a cart | `ProductResource` sends `purchasable: false`; `isPurchasable()` gates the add-to-cart and `addItem()` refuses |
| A cart that already contains it cannot check out silently | `checkoutGate()` refuses the checkout page with a domain-level error until the line is removed (regression-tested in `frontend/tests/checkoutGate.test.ts`) |

A legacy product therefore **fails closed**, loudly, with a Persian message
(`قیمت «…» هنوز نهایی نشده است و در حال حاضر قابل خریداری نیست.`) and a
machine-readable reason — never a wrong number.

### API compatibility shape

```jsonc
// a normal, priced product
{ "price": 1299000, "compare_at_price": 1699000, "currency": "IRT",
  "purchasable": true, "legacy_price": null, "legacy_compare_at_price": null,
  "legacy_currency": null }

// a preserved legacy row
{ "price": null, "compare_at_price": null, "currency": "USD",
  "purchasable": false, "legacy_price": "12.99",
  "legacy_compare_at_price": "16.99", "legacy_currency": "USD" }
```

`price: null` is deliberate and is **not** `0`. It means "this row has no
chargeable toman amount".

## 4. The migration

`database/migrations/2026_10_03_000001_consolidate_products_columns.php`

Four concerns are kept separate on purpose:

1. **SQL portability.** No vendor-specific numeric SQL. The previous body used
   `CAST(... AS INTEGER)`, which SQLite accepts and MySQL rejects with
   `ERROR 1064` — a defect the SQLite-only test suite could never see. Money is
   now validated in PHP through `App\Support\Money`, the same helper the model,
   the resources and the checkout service use.
2. **Numeric conversion.** None that loses information. A value becomes an
   integer only when it already *is* an exact non-negative integer. `12.99` is
   never rounded.
3. **Currency conversion.** None.
4. **Legacy preservation.** Original amounts, currency and a timestamp are
   copied into `legacy_*` columns verbatim before the money columns are changed.

### Execution order (and why it matters)

`price` is `DECIMAL(12,2) NOT NULL` beforehand. Two orderings each destroy data:

- Nulling a row's price **before** the column is nullable fails.
- Changing the column to an integer type **while a decimal is still in it**
  rounds that decimal during the `ALTER`.

So the migration: adds the preservation columns → makes `price` nullable *while
it is still DECIMAL* → walks the rows in PHP → asserts the order tables hold
only exact integers → performs the type changes → retires `name`/`status`.

### `orders.currency`

Added by the same migration with a default of `IRT`. An invoice must state its
own unit; `OrderResource` now returns `currency` on the order and on every line,
and `OrderService` writes it explicitly.

### Zero orders is not evidence

The order tables are empty today. The migration does not treat that as
permission: it **asserts** every stored order amount is an exact non-negative
integer and raises a `RuntimeException` naming the offending ids if not. An
amount it cannot represent aborts the migration instead of being multiplied by
a rate.

### Rollback

`down()` is a genuine inverse for the money: because no amount was ever
converted, `legacy_*` still holds the original values and they are restored
verbatim, after the column types are returned to `DECIMAL` (restoring the type
first, so nothing is truncated on the way back).

Two documented asymmetries:

- `status` returns as the two-state mirror of `is_active`; the retired
  `archived` value cannot be reconstructed.
- `price` stays nullable after a rollback. `up()` made "no toman amount" a legal
  state, and re-imposing `NOT NULL` is only safe on a database with no
  quarantined rows.

And two mirror effects of the `status` → `is_active` consolidation, both
observed in the P0-B rehearsal:

- A row whose `is_active` contradicted its `status` (e.g. `draft` with
  `is_active = 1`) comes back with `is_active` collapsed to the status mirror —
  `down()` rebuilds `status` from `is_active`, never the reverse.
- `name` is rebuilt from `title`: where the two originally differed the old
  `name` value is not recovered, and `title` values that were NULL (filled from
  `name` by `up()`) stay filled.

The **money** round-trip is exact: every legacy amount, currency and compare-at
value was restored verbatim by the rehearsed `down()`, and clean IRT integers
round-tripped through DECIMAL without loss.

### Failure and rerun behaviour (verified in rehearsal)

MySQL DDL commits implicitly, so a failure mid-migration leaves committed
partial state — that is expected and safe:

- The order-amount assertion runs **after** the preservation walk. A failure
  there leaves `legacy_*` written, `price` still `DECIMAL … NULL`, `name`/
  `status` still present, and the migration **unrecorded** — so the guard does
  not skip the unfinished work on the next run.
- Re-running after fixing the offending data completes the migration without
  any manual cleanup or database restore.
- The rehearsal exposed one real bug: the walk re-processed already-preserved
  rows on a rerun and overwrote `legacy_price` with NULL (the price column is
  empty by then). `walkProductMoney()` now skips rows whose
  `legacy_price_preserved_at` is set; `MigrationMoneySqlTest` asserts the guard
  stays in place.

### Why it was repaired in place

The migration is applied in no environment we can reach: the live MySQL database
stops at `2026_09_30_000001`, and the test suite builds a fresh in-memory schema
on every run. It is also unreleased, and its old body encoded a conversion
strategy that is now forbidden — shipping it and correcting it afterwards would
have applied the forbidden conversion first. The repaired body is additionally
idempotent: if `legacy_price` exists and `name` is already gone, it returns
without doing anything.

## 5. Recovery runbook

### If a database already ran the **old** body

That database applied `price × 100000`, set `currency = 'IRT'`, and kept no
record of the original amounts. It cannot be repaired from the schema — the
information is gone. **Restore it from a pre-migration backup.**

1. Stop the application writers against that database.
2. Take a safety copy of the current (corrupted) state for forensics:
   `mysqldump … > post-mortem.sql`.
3. Restore the pre-migration dump.
4. Apply the corrected migration.
5. Re-run `php artisan migrate:status` and confirm `2026_10_03_000001` is listed.

The repaired migration will *not* quietly "fix" such a database, because the
idempotency guard sees `legacy_price` and `name` already gone and returns early.

### Before executing the corrected migration

```bash
# 1. read-only pre-flight
docker exec toy-store-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B toy_store_db \
   -e "SELECT id,title,price,compare_at_price,currency FROM products ORDER BY id"'

# 2. backup (write — gate-approved)
docker exec toy-store-mysql-1 sh -c \
  'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines toy_store_db' \
  > backups/pre-p0.sql

# 3. apply
docker exec toy-store-laravel.app-1 php artisan migrate --force

# 4. verify (read-only)
docker exec toy-store-mysql-1 sh -c \
  'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -B toy_store_db \
   -e "SHOW COLUMNS FROM products; SELECT id,price,currency,legacy_price,legacy_currency FROM products"'
```

Expected result for the six legacy rows: `price` and `compare_at_price` are
`NULL`, `currency` is `USD`, and `legacy_*` holds the original decimals. `0` rows
in `orders` is not part of the acceptance reasoning — the assertion inside the
migration already covers the order tables.

### Verifying a rollback (on a restored copy, never on the live database)

```bash
docker exec toy-store-laravel.app-1 php artisan migrate:rollback --step=1
```

## 6. What still needs a human decision (blocks P0-B)

The six legacy rows have no toman amount. Three strategies are available and
**none has been chosen**:

1. **Convert at an approved rate.** Requires an explicit number from the owner.
   The migration deliberately does not contain one.
2. **Quarantine.** Leave `price = NULL`, keep the rows out of the storefront
   (today they are still `is_active = 1`, so they appear as unpurchasable). The
   migration deliberately does not change `is_active` — that is a merchandising
   decision, and leaving it alone keeps the rollback exact.
3. **Hand-correct.** Enter six exact toman integers in the admin panel; the
   legacy notice shows the original amount next to the field.

Related decisions also still open: whether quarantined products should be
unpublished, and whether the Intel `gameready`/`free` filename tokens survive
into product titles (P2).
