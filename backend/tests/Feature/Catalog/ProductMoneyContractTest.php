<?php

namespace Tests\Feature\Catalog;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * The storefront's money contract, end to end through the API.
 *
 * Three states must be distinguishable by the client, and this class pins all
 * three:
 *
 *   1. a priced toman product  → `price` is an exact integer, `purchasable` true
 *   2. a preserved legacy row  → `price` null, `currency` 'USD', `purchasable`
 *                                false, the original amount kept verbatim
 *   3. a fractional amount     → `price` null, `purchasable` false
 *
 * The regression being locked out: `12.99 USD` reaching the browser as `12`,
 * which the storefront then rendered as twelve toman.
 */
class ProductMoneyContractTest extends TestCase
{
    use RefreshDatabase;

    private const PRODUCTS = '/api/v1/products';

    /**
     * Insert a row the way the pre-contract schema allowed it.
     *
     * Written straight through the query builder on purpose: the model's own
     * setter now refuses to store a decimal, so this is exactly the shape of
     * data that predates the contract — including the six legacy USD products
     * currently in the development database.
     */
    private function insertLegacyRow(string $slug, string $amount, string $currency): Product
    {
        DB::table('products')->insert([
            'title' => 'Legacy '.$slug,
            'slug' => $slug,
            'price' => $amount,
            'compare_at_price' => null,
            'currency' => $currency,
            'stock' => 5,
            'is_active' => 1,
            'attributes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Product::query()->where('slug', $slug)->sole();
    }

    public function test_an_irt_row_exposes_an_exact_integer_amount(): void
    {
        $product = Product::factory()->pricedAt(1_299_000)->create([
            'slug' => 'duck',
            'compare_at_price' => 1_699_000,
        ]);

        $response = $this->getJson(self::PRODUCTS.'/duck');

        $response->assertOk()
            ->assertJsonPath('data.currency', 'IRT')
            ->assertJsonPath('data.purchasable', true)
            ->assertJsonPath('data.legacy_price', null)
            ->assertJsonPath('data.legacy_currency', null);

        $this->assertSame(1_299_000, $response->json('data.price'));
        $this->assertSame(1_699_000, $response->json('data.compare_at_price'));

        $this->assertSame(1_299_000, $product->fresh()->price);
        $this->assertTrue($product->fresh()->purchasable());
    }

    public function test_a_legacy_usd_amount_is_never_published_as_a_truncated_toman_price(): void
    {
        $product = $this->insertLegacyRow('legacy-duck', '12.99', 'USD');

        $this->assertNull($product->price, 'A USD amount must not become an IRT integer.');
        $this->assertFalse($product->purchasable());
        $this->assertSame('12.99', $product->legacyAmount());
        $this->assertSame('USD', $product->legacyCurrency());

        $response = $this->getJson(self::PRODUCTS.'/legacy-duck');

        $response->assertOk()
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.purchasable', false)
            ->assertJsonPath('data.legacy_price', '12.99')
            ->assertJsonPath('data.legacy_currency', 'USD');

        // The exact regression: not 12, not 0 — no toman amount at all.
        $this->assertNotSame(12, $response->json('data.price'));
        $this->assertNotSame(0, $response->json('data.price'));
    }

    public function test_a_fractional_toman_amount_is_refused_rather_than_rounded(): void
    {
        // Same currency, unusable amount: 12.99 toman is not payable.
        $product = $this->insertLegacyRow('fractional', '12.99', 'IRT');

        $this->assertNull($product->price);
        $this->assertFalse($product->purchasable());

        $this->getJson(self::PRODUCTS.'/fractional')
            ->assertOk()
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.currency', 'IRT')
            ->assertJsonPath('data.purchasable', false)
            ->assertJsonPath('data.legacy_price', '12.99');
    }

    public function test_a_decimal_amount_cannot_be_written_through_the_model(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Product::factory()->create(['slug' => 'bad-price', 'price' => 12.99]);
    }

    public function test_the_listing_carries_the_same_money_contract_as_the_detail(): void
    {
        Product::factory()->pricedAt(6_400_000)->create(['slug' => 'blocks']);
        // Two decimal places that survive SQLite's numeric affinity; `18.50`
        // would come back as `18.5` there (MySQL's DECIMAL keeps both).
        $this->insertLegacyRow('legacy-sub', '48.25', 'USD');

        $response = $this->getJson(self::PRODUCTS);

        $response->assertOk()->assertJsonCount(2, 'data.data');

        $rows = collect($response->json('data.data'))->keyBy('slug');

        $this->assertSame(6_400_000, $rows['blocks']['price']);
        $this->assertTrue($rows['blocks']['purchasable']);
        $this->assertNull($rows['blocks']['legacy_price']);

        $this->assertNull($rows['legacy-sub']['price']);
        $this->assertFalse($rows['legacy-sub']['purchasable']);
        $this->assertSame('48.25', $rows['legacy-sub']['legacy_price']);
        $this->assertSame('USD', $rows['legacy-sub']['legacy_currency']);
    }

    public function test_the_migrated_schema_supports_the_contract(): void
    {
        $this->assertTrue(Schema::hasColumn('products', 'legacy_price'));
        $this->assertTrue(Schema::hasColumn('products', 'legacy_compare_at_price'));
        $this->assertTrue(Schema::hasColumn('products', 'legacy_currency'));
        $this->assertTrue(Schema::hasColumn('products', 'legacy_price_preserved_at'));

        // An invoice states its own unit.
        $this->assertTrue(Schema::hasColumn('orders', 'currency'));

        // The duplicated columns are gone; `title` is the single name column.
        $this->assertFalse(Schema::hasColumn('products', 'name'));
        $this->assertFalse(Schema::hasColumn('products', 'status'));
    }
}
