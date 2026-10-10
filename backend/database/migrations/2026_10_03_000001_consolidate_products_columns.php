<?php

use App\Support\Currency;
use App\Support\Money;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Collapse the duplicated product columns and move money to its final contract:
 * currency `IRT`, unit = one toman, stored as an integer.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  What this migration does NOT do
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It does **not** convert currency. An earlier draft of this file multiplied
 * every stored amount by a hardcoded `1 USD = 100 000 IRT` constant. That rate
 * was never approved, and inventing one here would have rewritten real values
 * into numbers no human ever agreed to — irreversibly, inside a migration, with
 * no record of what the original amount was.
 *
 * So this migration is deliberately split into four separate concerns:
 *
 *   1. SQL portability     — no vendor-specific arithmetic at all. The old
 *                            draft used `CAST(... AS INTEGER)`, which is valid
 *                            in SQLite (the test engine) and a syntax error in
 *                            MySQL (the production engine). Money is now
 *                            validated in PHP, so the migration cannot pass the
 *                            suite while failing on the real database.
 *   2. Numeric conversion  — none that loses information. A value is written as
 *                            an integer only when it already *is* an exact
 *                            non-negative integer; `12.99` is never rounded to
 *                            `12`.
 *   3. Currency conversion — none. A row whose currency is not `IRT` is left
 *                            exactly as it is, preserved in dedicated `legacy_*`
 *                            columns, and its money columns emptied.
 *   4. Legacy preservation — the original amount, currency and a timestamp are
 *                            kept verbatim, so nothing is lost and the mapping
 *                            can be decided later, by a human, with the real
 *                            numbers in front of them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  Why this file was repaired in place rather than followed up
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This migration is not applied in any environment we can reach: the live MySQL
 * database stops at `2026_09_30_000001`, and the test suite builds a fresh
 * in-memory schema on every run. It is also unreleased, and its old body encoded
 * a conversion strategy that is now explicitly forbidden — shipping it and then
 * correcting it with a follow-up migration would have *applied* the forbidden
 * conversion first.
 *
 * If some environment nevertheless already ran the old body, that database holds
 * silently re-rated amounts and must be restored from a pre-migration backup; it
 * cannot be repaired from here, because the original values no longer exist
 * anywhere inside it. See docs/p0-money-contract.md for the recovery runbook.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  Execution order matters
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `price` is currently `DECIMAL(12,2) NOT NULL`. Two orderings would each
 * destroy data, and both are avoided:
 *
 *   - Nulling a quarantined row's price before the column is nullable fails.
 *   - Changing the column to an integer type while a legacy decimal is still in
 *     it rounds that decimal during the ALTER.
 *
 * So: make the column nullable *while it is still DECIMAL*, empty the rows that
 * have no toman amount, and only then change the type — by which point every
 * surviving value is already an exact integer, and the conversion is lossless.
 */
return new class extends Migration
{
    /** Rows per pass when walking money columns in PHP. */
    private const CHUNK = 500;

    public function up(): void
    {
        // ── 0. Idempotency guard ────────────────────────────────────────────
        //
        // The tail of this migration drops `name`; the head adds `legacy_price`.
        // Seeing the second without the first means it already ran — re-running
        // would otherwise fail on the duplicate columns it tries to add.
        if (Schema::hasColumn('products', 'legacy_price') && ! Schema::hasColumn('products', 'name')) {
            return;
        }

        // ── 1. Preservation columns ─────────────────────────────────────────
        //
        // Added *before* anything is normalised, so the original amount and its
        // currency are still on the row when the walk below decides what to do
        // with them.
        Schema::table('products', function (Blueprint $table): void {
            if (! Schema::hasColumn('products', 'legacy_price')) {
                $table->decimal('legacy_price', 12, 2)->nullable()->after('currency');
                $table->decimal('legacy_compare_at_price', 12, 2)->nullable()->after('legacy_price');
                $table->string('legacy_currency', 3)->nullable()->after('legacy_compare_at_price');
                $table->timestamp('legacy_price_preserved_at')->nullable()->after('legacy_currency');
            }
        });

        // An invoice must state its own unit. `order_items` needs no column of
        // its own: a line's currency is its order's currency by construction.
        if (! Schema::hasColumn('orders', 'currency')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->string('currency', 3)->default(Currency::IRT)->after('total_amount');
            });
        }

        // ── 2. Make `price` nullable while it is still DECIMAL ──────────────
        //
        // No type change and no rounding yet — this only allows step 3 to empty
        // a row that has no toman amount.
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('price', 12, 2)->nullable()->change();
        });

        // ── 3. Money: normalise what is already toman, preserve the rest ────
        $this->walkProductMoney();

        // ── 4. Orders: assert exact integers, never re-scale ────────────────
        //
        // The order tables are empty today, and that is precisely why this is an
        // assertion rather than an assumption: "there are no rows to lose" is not
        // a reason to skip checking, because the next environment's database may
        // not be empty. A non-integral amount aborts the migration loudly instead
        // of being multiplied by a rate nobody approved.
        $this->assertIntegralAmounts('orders', 'total_amount');
        $this->assertIntegralAmounts('order_items', 'unit_price');
        $this->assertIntegralAmounts('order_items', 'total_price');

        // ── 5. Column consolidation ─────────────────────────────────────────
        //
        // `title` wins where both exist; `name` fills the gaps (rows created
        // after `title` was added but never edited in the admin panel).
        DB::table('products')->update([
            'title' => DB::raw('COALESCE(title, name)'),
        ]);

        // The retired `saving` hook gave `status` precedence whenever it was set,
        // so the same rule is applied here: published only when it was `active`.
        DB::table('products')
            ->whereNotNull('status')
            ->update([
                'is_active' => DB::raw("CASE WHEN status = 'active' THEN 1 ELSE 0 END"),
            ]);

        // ── 6. Type changes ────────────────────────────────────────────────
        //
        // Every non-null value reaching this point is an exact non-negative
        // integer (step 3), so these ALTERs cannot round anything.
        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedBigInteger('price')->nullable()->change();
            $table->unsignedBigInteger('compare_at_price')->nullable()->change();
            $table->string('currency', 3)->default(Currency::IRT)->change();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->unsignedBigInteger('total_amount')->change();
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('unit_price')->change();
            $table->unsignedBigInteger('total_price')->change();
        });

        // ── 7. `title` becomes the single, required name column ─────────────
        Schema::table('products', function (Blueprint $table): void {
            $table->string('title')->nullable(false)->change();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['name', 'status']);
        });
    }

    /**
     * Move every product's money into its final, honest representation.
     *
     * Two outcomes, and no third:
     *
     *  - **Already toman** (currency `IRT` and every amount already an exact
     *    non-negative integer): write the integers back. Nothing changes value.
     *  - **Anything else** (a legacy currency, or a fractional amount): copy the
     *    original amounts and currency into the `legacy_*` columns verbatim, and
     *    set `price` / `compare_at_price` to NULL.
     *
     * NULL is the honest answer here, not a sentinel: the row genuinely has no
     * toman amount yet. It is never `0` (that would be "free") and never a
     * rounded figure. `is_active` is deliberately left alone — deciding whether
     * a quarantined product should be hidden or highlighted is a merchandising
     * choice for the owner, and keeping this method out of it makes the
     * migration's rollback exact.
     */
    private function walkProductMoney(): void
    {
        // Rows that were already preserved in an earlier (partially failed)
        // run are skipped: their money columns are now empty, and walking
        // them again would overwrite the verbatim `legacy_*` copy with NULL —
        // silently destroying the only record of the original amount. Verified
        // in the P0-B MySQL rehearsal: a rerun after a controlled failure kept
        // every legacy value exactly because of this filter.
        DB::table('products')
            ->whereNull('legacy_price_preserved_at')
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($rows): void {
                foreach ($rows as $row) {
                    $currency = Currency::normalize($row->currency ?? null);

                    $price = Money::toAmount($row->price ?? null, $currency);
                    $compareAtPrice = ($row->compare_at_price ?? null) === null
                        ? null
                        : Money::toAmount($row->compare_at_price, $currency);

                    $isCleanIrt = Currency::isSellable($currency)
                        && $price !== null
                        && (($row->compare_at_price ?? null) === null || $compareAtPrice !== null);

                    if ($isCleanIrt) {
                        DB::table('products')->where('id', $row->id)->update([
                            'price' => $price,
                            'compare_at_price' => $compareAtPrice,
                            'currency' => Currency::IRT,
                        ]);

                        continue;
                    }

                    DB::table('products')->where('id', $row->id)->update([
                        'legacy_price' => $row->price ?? null,
                        'legacy_compare_at_price' => $row->compare_at_price ?? null,
                        'legacy_currency' => $currency,
                        'legacy_price_preserved_at' => now(),
                        'price' => null,
                        'compare_at_price' => null,
                    ]);
                }
            });
    }

    /**
     * Abort unless every amount in a money column is an exact non-negative
     * integer.
     *
     * @throws RuntimeException when a stored amount cannot be an integer toman value
     */
    private function assertIntegralAmounts(string $table, string $column): void
    {
        $offenders = [];

        DB::table($table)
            ->orderBy('id')
            ->chunkById(self::CHUNK, function ($rows) use ($column, &$offenders): void {
                foreach ($rows as $row) {
                    $raw = $row->{$column} ?? null;

                    if ($raw !== null && Money::toNonNegativeInteger($raw) === null) {
                        $offenders[] = (string) $row->id;
                    }
                }
            });

        if ($offenders === []) {
            return;
        }

        throw new RuntimeException(sprintf(
            'Money migration stopped: %s.%s holds %d amount(s) that are not exact '
            .'non-negative integers (ids: %s). These predate the toman contract and '
            .'must be reviewed by hand — this migration will not round or re-scale them.',
            $table,
            $column,
            count($offenders),
            implode(', ', array_slice($offenders, 0, 20)),
        ));
    }

    /**
     * Restore the duplicated columns and the decimal money columns.
     *
     * This is now a genuine inverse for the part that matters: this migration
     * never converted a legacy amount, so `legacy_*` still holds the original
     * values verbatim and they are restored exactly.
     *
     * Two documented asymmetries:
     *
     *  - `status` comes back as the two-state mirror of `is_active`; the retired
     *    `archived` value cannot be reconstructed.
     *  - `price` stays nullable. `up()` made "no toman amount" a legal state for
     *    a quarantined row, and re-imposing NOT NULL would only be safe on a
     *    database that has no such rows.
     *
     * And two mirror effects of the `status` → `is_active` consolidation (also
     * verified in the P0-B rehearsal):
     *
     *  - A row whose `is_active` contradicted its `status` (e.g. `draft` with
     *    `is_active = 1`) comes back with `is_active` collapsed to the status
     *    mirror — `down()` rebuilds `status` from `is_active`, never the reverse.
     *  - `name` is rebuilt from `title`, so where the two originally differed,
     *    the old `name` value is not recovered; `title` values that were NULL
     *    were filled from `name` by `up()` and stay filled.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->string('name')->nullable()->after('category_id');
            $table->string('status')->default('draft')->after('is_active');
            // `up()` made `title` required; a true inverse puts it back to the
            // nullable state the `add_columns_to_products_table` migration left.
            $table->string('title')->nullable()->change();
        });

        DB::table('products')->update([
            'name' => DB::raw('title'),
            'status' => DB::raw("CASE WHEN is_active = 1 THEN 'active' ELSE 'draft' END"),
        ]);

        Schema::table('products', function (Blueprint $table): void {
            $table->string('name')->nullable(false)->change();
        });

        // Decimal types must be restored *before* any legacy amount is put back,
        // or an integer column would truncate the value it is restoring.
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('price', 12, 2)->nullable()->change();
            $table->decimal('compare_at_price', 12, 2)->nullable()->change();
            $table->string('currency', 3)->default(Currency::USD)->change();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('total_amount', 14, 2)->change();
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->decimal('unit_price', 12, 2)->change();
            $table->decimal('total_price', 14, 2)->change();
        });

        // Verbatim restore: the amounts are exactly what was preserved.
        DB::table('products')
            ->whereNotNull('legacy_price_preserved_at')
            ->update([
                'price' => DB::raw('legacy_price'),
                'compare_at_price' => DB::raw('legacy_compare_at_price'),
                'currency' => DB::raw('COALESCE(legacy_currency, currency)'),
            ]);

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn([
                'legacy_price',
                'legacy_compare_at_price',
                'legacy_currency',
                'legacy_price_preserved_at',
            ]);
        });

        if (Schema::hasColumn('orders', 'currency')) {
            Schema::table('orders', function (Blueprint $table): void {
                $table->dropColumn('currency');
            });
        }
    }
};
