<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Collapse the duplicated product columns and switch money to integer Toman.
 *
 * Two legacy duplications are removed:
 *
 *  - `name` / `title` — a `saving` hook kept them in sync. `title` is kept: it
 *    is the column the Filament admin panel edits and the one the storefront
 *    now renders. `name` is dropped.
 *  - `status` / `is_active` — the same hook mirrored them. `is_active` is kept
 *    because it is the column the reviewed business logic actually enforces
 *    (CatalogService visibility, OrderService purchasability, ProductResource
 *    payload). The three-state `status` select becomes a Published toggle in
 *    the admin panel; `archived` is therefore retired.
 *
 * Money stops being a decimal: the single currency is Toman and one Toman is
 * the smallest unit, so every amount is an integer. Existing decimal rows are
 * converted here at one documented demo rate before the columns change type,
 * and the seeder writes clean Toman values on top.
 */
return new class extends Migration
{
    /**
     * Demo conversion rate applied to the pre-Toman decimal rows.
     *
     * The seeded catalog was priced in USD (12.99, 189.99, …). This is a
     * pre-launch store whose only data is demo data, so one documented,
     * deterministic rate is enough to make the numbers plausible:
     *
     *     1 USD = 100 000 IRT
     *
     * Real production data would be imported at the day's actual rate; a
     * hardcoded constant is only acceptable because there is nothing real to
     * lose, and it is documented rather than silent.
     */
    private const USD_TO_IRT = 100000;

    public function up(): void
    {
        // ── 1. Backfill before dropping ──────────────────────────────────

        // `title` wins where both exist; `name` fills the gaps (rows created
        // after the `title` column was added but never edited by the admin).
        DB::table('products')->update([
            'title' => DB::raw('COALESCE(title, name)'),
        ]);

        // The removed `saving` hook gave `status` precedence whenever it was
        // set, so the same rule is applied here: a row is published only when
        // it was `active`. Rows with a NULL status predate the column and keep
        // their existing `is_active`.
        DB::table('products')
            ->whereNotNull('status')
            ->update([
                'is_active' => DB::raw("CASE WHEN status = 'active' THEN 1 ELSE 0 END"),
            ]);

        // ── 2. Money: decimal USD → integer Toman ────────────────────────

        $rate = self::USD_TO_IRT;

        DB::table('products')->update([
            'price' => DB::raw("CAST(ROUND(price * {$rate}) AS INTEGER)"),
            'compare_at_price' => DB::raw("CAST(ROUND(COALESCE(compare_at_price, 0) * {$rate}) AS INTEGER)"),
            'currency' => 'IRT',
        ]);

        // NULL must survive the conversion: it means "no strike-through price".
        DB::table('products')
            ->where('compare_at_price', 0)
            ->update(['compare_at_price' => null]);

        DB::table('orders')->update([
            'total_amount' => DB::raw("CAST(ROUND(total_amount * {$rate}) AS INTEGER)"),
        ]);

        DB::table('order_items')->update([
            'unit_price' => DB::raw("CAST(ROUND(unit_price * {$rate}) AS INTEGER)"),
            'total_price' => DB::raw("CAST(ROUND(total_price * {$rate}) AS INTEGER)"),
        ]);

        // ── 3. Schema ────────────────────────────────────────────────────

        // One rebuild per call: keeping the type changes and the drops in
        // separate statements is what SQLite (which recreates the table for
        // each alter) handles most predictably.
        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedBigInteger('price')->change();
            $table->unsignedBigInteger('compare_at_price')->nullable()->change();
            $table->string('currency', 3)->default('IRT')->change();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->unsignedBigInteger('total_amount')->change();
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->unsignedBigInteger('unit_price')->change();
            $table->unsignedBigInteger('total_price')->change();
        });

        // `title` becomes the single, required name column: every row was
        // backfilled above.
        Schema::table('products', function (Blueprint $table): void {
            $table->string('title')->nullable(false)->change();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['name', 'status']);
        });
    }

    /**
     * Restore the duplicated columns and the decimal money columns.
     *
     * This rollback is best-effort by nature: `status` comes back as the
     * two-state mirror of `is_active` (the retired `archived` value cannot be
     * reconstructed) and the USD amounts are re-derived by dividing by the same
     * documented demo rate.
     */
    public function down(): void
    {
        $rate = self::USD_TO_IRT;

        Schema::table('products', function (Blueprint $table): void {
            $table->string('name')->nullable()->after('category_id');
            $table->string('status')->default('draft')->after('is_active');
            // `up()` made `title` required; a true inverse puts it back to the
            // nullable state the `add_columns_to_products_table` migration left it in.
            $table->string('title')->nullable()->change();
        });

        DB::table('products')->update([
            'name' => DB::raw('title'),
            'status' => DB::raw("CASE WHEN is_active = 1 THEN 'active' ELSE 'draft' END"),
        ]);

        Schema::table('products', function (Blueprint $table): void {
            $table->string('name')->nullable(false)->change();
        });

        // Decimal types must be restored *before* the division, or integer
        // columns would truncate the result of every conversion.
        Schema::table('products', function (Blueprint $table): void {
            $table->decimal('price', 12, 2)->change();
            $table->decimal('compare_at_price', 12, 2)->nullable()->change();
            $table->string('currency', 3)->default('USD')->change();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('total_amount', 14, 2)->change();
        });

        Schema::table('order_items', function (Blueprint $table): void {
            $table->decimal('unit_price', 12, 2)->change();
            $table->decimal('total_price', 14, 2)->change();
        });

        DB::table('products')->update([
            'price' => DB::raw(sprintf('price / %d', $rate)),
            'compare_at_price' => DB::raw(sprintf('compare_at_price / %d', $rate)),
            'currency' => 'USD',
        ]);

        DB::table('orders')->update([
            'total_amount' => DB::raw(sprintf('total_amount / %d', $rate)),
        ]);

        DB::table('order_items')->update([
            'unit_price' => DB::raw(sprintf('unit_price / %d', $rate)),
            'total_price' => DB::raw(sprintf('total_price / %d', $rate)),
        ]);
    }
};