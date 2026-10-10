<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Guards the money migration's SQL against the dialect trap that let a broken
 * migration pass this suite.
 *
 * The original body used `CAST(... AS INTEGER)`. SQLite accepts that; MySQL
 * rejects it with `ERROR 1064`. Because the suite runs on SQLite, the migration
 * looked green while being unrunnable on the production engine — and could only
 * ever have failed on the real database, during deployment.
 *
 * These are deliberately *static* assertions on the migration sources. They run
 * on every engine, need no MySQL server, and fail the moment someone
 * reintroduces vendor-specific numeric SQL or an invented exchange rate.
 */
class MigrationMoneySqlTest extends TestCase
{
    private const MONEY_MIGRATION = '2026_10_03_000001_consolidate_products_columns.php';

    public function test_no_migration_casts_to_the_sqlite_only_integer_type(): void
    {
        $offenders = [];

        foreach ($this->migrationSources() as $name => $source) {
            if (preg_match('/CAST\s*\(.*?AS\s+INTEGER\s*\)/is', $this->codeOnly($source)) === 1) {
                $offenders[] = $name;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'These migrations use CAST(... AS INTEGER): valid in SQLite, a syntax error in '
            .'MySQL. Use a portable expression, or do the work in PHP.',
        );
    }

    public function test_no_migration_silently_rounds_a_stored_amount(): void
    {
        $offenders = [];

        foreach ($this->migrationSources() as $name => $source) {
            if (preg_match('/CAST\s*\([^)]*\bAS\s+(SIGNED|UNSIGNED|INT)\b/i', $this->codeOnly($source)) === 1) {
                $offenders[] = $name;
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'Swapping INTEGER for SIGNED would make the SQL run, but an ALTER or UPDATE that '
            .'rounds a legacy decimal still destroys the value. Money is validated in PHP.',
        );
    }

    public function test_the_money_migration_invents_no_exchange_rate(): void
    {
        $source = $this->codeOnly($this->moneyMigration());

        $this->assertStringNotContainsString('USD_TO_IRT', $source);
        $this->assertStringNotContainsString('100000', $source);

        // No arithmetic on a stored amount, in any column, anywhere.
        $this->assertDoesNotMatchRegularExpression(
            '/\b(price|total_amount|unit_price|total_price)\s*\*/',
            $source,
        );
    }

    public function test_the_money_migration_preserves_legacy_amounts(): void
    {
        $source = $this->codeOnly($this->moneyMigration());

        foreach ([
            'legacy_price',
            'legacy_compare_at_price',
            'legacy_currency',
            'legacy_price_preserved_at',
        ] as $column) {
            $this->assertStringContainsString($column, $source);
        }
    }

    public function test_the_money_migration_checks_amounts_instead_of_assuming_them(): void
    {
        $source = $this->codeOnly($this->moneyMigration());

        // Integrality is asserted through the shared helper...
        $this->assertStringContainsString('toNonNegativeInteger', $source);

        // ...and a non-integral amount aborts the migration rather than being
        // multiplied by a rate. "There are no orders" is not a reason to skip
        // the check.
        $this->assertStringContainsString('RuntimeException', $source);
        $this->assertStringContainsString('assertIntegralAmounts', $source);
        $this->assertStringContainsString("assertIntegralAmounts('orders', 'total_amount')", $source);
    }

    /**
     * A partially failed run must be safely rerunnable.
     *
     * Found by the P0-B MySQL rehearsal: the money walk runs *before* the
     * order-amount assertion, so a failure at the assertion leaves the
     * products already walked — price columns emptied, values copied into
     * `legacy_*`. A second run would then read the empty price and overwrite
     * the verbatim legacy copy with NULL, destroying the only record of the
     * original amount. The walk must therefore skip rows already preserved,
     * and the idempotency guard must not let a partial run skip required work.
     */
    public function test_a_partially_failed_run_can_be_rerun_without_losing_legacy_values(): void
    {
        $source = $this->codeOnly($this->moneyMigration());

        $this->assertStringContainsString(
            "whereNull('legacy_price_preserved_at')",
            $source,
            'walkProductMoney must skip already-preserved rows: re-walking them '
            .'after a partial failure would overwrite legacy_price with NULL.',
        );

        // The guard only fires when BOTH `legacy_price` exists and `name` is
        // gone — a partially applied run still has `name`, so it proceeds
        // instead of silently skipping the unfinished work.
        $this->assertStringContainsString("Schema::hasColumn('products', 'legacy_price')", $source);
        $this->assertStringContainsString("Schema::hasColumn('products', 'name')", $source);
    }

    /**
     * Every migration source, keyed by file name.
     *
     * @return array<string, string>
     */
    private function migrationSources(): array
    {
        $sources = [];

        foreach (glob(database_path('migrations/*.php')) ?: [] as $file) {
            $sources[basename($file)] = (string) file_get_contents($file);
        }

        $this->assertNotSame([], $sources, 'No migrations found — the path is wrong.');

        return $sources;
    }

    /**
     * Migration source with comments removed.
     *
     * The scans below look for SQL patterns, and the migration *documents* the
     * defect it fixes — a docblock quoting `CAST(... AS INTEGER)` would otherwise
     * trip its own guard. Comments are never executed, so they are not code.
     */
    private function codeOnly(string $source): string
    {
        $code = '';

        foreach (token_get_all($source) as $token) {
            if (is_array($token)) {
                if ($token[0] === T_COMMENT || $token[0] === T_DOC_COMMENT) {
                    continue;
                }

                $code .= $token[1];

                continue;
            }

            $code .= $token;
        }

        return $code;
    }

    private function moneyMigration(): string
    {
        $path = database_path('migrations/'.self::MONEY_MIGRATION);

        $this->assertFileExists($path);

        return (string) file_get_contents($path);
    }
}
