<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductMedia3D;
use Illuminate\Console\Command;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The catalog's discovery contract: every product on a shelf the storefront can
 * navigate to, and nothing else moved to get it there.
 *
 * The fixture products used to exist only at their own URLs (`category_id`
 * null), which made them unreachable from `/categories/{slug}` — the way a
 * customer actually browses. These tests pin the three moving parts:
 *
 *  - the taxonomy and the fixture manifest agree (a category slug that is not in
 *    config/catalog.php is a product no category page can list),
 *  - `toys:assign-categories` applies that mapping and is idempotent, and
 *  - it writes `category_id` and nothing else — no price, no currency, no legacy
 *    amount, and no product or category duplicated.
 */
class CategoryDiscoveryTest extends TestCase
{
    use RefreshDatabase;

    private const PRODUCTS = '/api/v1/products';

    public function test_the_taxonomy_has_stable_unique_slugs_and_a_complete_palette(): void
    {
        $taxonomy = $this->taxonomy();
        $slugs = array_column($taxonomy, 'slug');

        // The slugs are route segments (`/categories/{slug}`) and API filters, so
        // they are pinned here: renaming one silently breaks shared links.
        $this->assertSame(
            ['bath-toys', 'building-blocks', 'collectible-figures', 'remote-control', 'model-cars', 'blasters'],
            $slugs,
        );

        foreach ($taxonomy as $category) {
            $this->assertNotSame('', trim((string) $category['name']));
            $this->assertNotSame('', trim((string) ($category['description'] ?? '')));

            foreach (['primary_color', 'glow_color', 'accent_color', 'background_color'] as $key) {
                $this->assertMatchesRegularExpression(
                    '/^#[0-9a-f]{6}$/i',
                    (string) ($category['theme_config'][$key] ?? ''),
                    "Category {$category['slug']} is missing a usable {$key}.",
                );
            }
        }
    }

    public function test_every_ingested_fixture_names_a_category_from_the_taxonomy(): void
    {
        $taxonomy = array_column($this->taxonomy(), 'slug');

        /** @var list<array<string, mixed>> $entries */
        $entries = (array) config('media_ingest.entries', []);

        $this->assertCount(8, $entries);

        foreach ($entries as $entry) {
            $slug = (string) $entry['slug'];
            $category = $entry['category'] ?? null;

            $this->assertIsString($category, "Fixture {$slug} does not name a category.");
            $this->assertContains(
                $category,
                $taxonomy,
                "Fixture {$slug} names [{$category}], which config/catalog.php does not define.",
            );
        }
    }

    public function test_the_assignment_command_shelves_every_mapped_product_and_is_idempotent(): void
    {
        $mapping = $this->shippedMapping();

        $this->assertCount(8, $mapping);

        foreach (array_keys($mapping) as $slug) {
            Product::factory()->create([
                'slug' => $slug,
                'category_id' => null,
                'price' => null,
                'currency' => 'IRT',
            ]);
        }

        // A preserved legacy row: its money must survive the run untouched.
        $legacy = Product::factory()->create([
            'slug' => 'legacy-usd-duck',
            'category_id' => null,
            'price' => null,
            'compare_at_price' => null,
            'currency' => 'USD',
        ]);

        DB::table('products')->where('id', $legacy->id)->update([
            'legacy_price' => 12.99,
            'legacy_currency' => 'USD',
            'legacy_price_preserved_at' => now(),
        ]);

        $this->artisan('toys:assign-categories')->assertExitCode(Command::SUCCESS);

        foreach ($mapping as $productSlug => $categorySlug) {
            $this->assertSame(
                $categorySlug,
                Product::query()->where('slug', $productSlug)->firstOrFail()->category?->slug,
                "Product {$productSlug} was not shelved on {$categorySlug}.",
            );
        }

        // Exactly the taxonomy — not one category per model.
        $this->assertSame(6, Category::count());
        $this->assertSame(9, Product::count());

        $after = Product::query()->findOrFail($legacy->id);

        $this->assertSame('USD', $after->currency);
        $this->assertNull($after->price);
        $this->assertSame('12.99', $after->legacyAmount('price'));
        $this->assertFalse($after->purchasable());

        // Re-running is a no-op: same rows, same categories, no duplicates.
        $before = $this->rowSnapshot();

        $this->artisan('toys:assign-categories')->assertExitCode(Command::SUCCESS);

        $this->assertSame($before, $this->rowSnapshot());
        $this->assertSame(6, Category::count());
        $this->assertSame(9, Product::count());
    }

    public function test_a_dry_run_creates_no_category_and_moves_no_product(): void
    {
        Product::factory()->create(['slug' => 'ford-mustang-1965', 'category_id' => null]);

        $this->artisan('toys:assign-categories', ['--dry-run' => true])
            ->assertExitCode(Command::SUCCESS);

        $this->assertSame(0, Category::count());
        $this->assertNull(Product::query()->where('slug', 'ford-mustang-1965')->value('category_id'));
    }

    public function test_the_command_leaves_products_it_does_not_own_on_their_own_shelf(): void
    {
        $own = Category::factory()->create(['slug' => 'robots', 'name' => 'Robots']);
        $other = Product::factory()->create(['slug' => 'trail-blazer-4x4', 'category_id' => $own->id]);

        Product::factory()->create(['slug' => 'halo-smg-blaster', 'category_id' => null]);

        $this->artisan('toys:assign-categories')->assertExitCode(Command::SUCCESS);

        $this->assertSame($own->id, Product::query()->findOrFail($other->id)->category_id);
        $this->assertSame('blasters', Product::query()->where('slug', 'halo-smg-blaster')->firstOrFail()->category?->slug);
    }

    public function test_a_product_without_a_category_is_still_listed_with_its_model(): void
    {
        $product = Product::factory()->create([
            'slug' => 'unfiled-toy',
            'category_id' => null,
            'price' => null,
            'currency' => 'IRT',
        ]);

        ProductMedia3D::withoutEvents(fn () => ProductMedia3D::query()->create([
            'product_id' => $product->id,
            'original_file_url' => 'models/unfiled.glb',
            'lighting_preset' => 'studio',
        ]));

        $response = $this->getJson(self::PRODUCTS);

        $response->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'unfiled-toy')
            // `category` is null, not absent: the storefront's type is nullable
            // and a card renders its "no category" badge off exactly this.
            ->assertJsonPath('data.data.0.category', null)
            ->assertJsonPath('data.data.0.media_3d.format', 'glb');

        $url = (string) $response->json('data.data.0.media_3d.url');

        $this->assertStringContainsString('models/unfiled.glb', $url);
        $this->assertStringNotContainsString('minio:9000', $url);
    }

    public function test_filtering_by_an_unknown_category_is_an_empty_page_not_an_error(): void
    {
        Product::factory()->count(2)->create();

        // The endpoint is a filter, so "nothing matches" is the honest answer;
        // the *storefront* is where an unknown slug becomes a 404
        // (`getCategoryBySlug()` returns null → `notFound()`), because a
        // category is a page and a page that does not exist must say so.
        $this->getJson(self::PRODUCTS.'?category=does-not-exist')
            ->assertOk()
            ->assertJsonCount(0, 'data.data')
            ->assertJsonPath('data.meta.total', 0)
            ->assertJsonPath('success', true);
    }

    /**
     * The taxonomy, read from config (the same list the seeder and the commands
     * use), not from a copy that could drift.
     *
     * @return list<array{slug: string, name: string, description?: string|null, theme_config?: array<string, string>}>
     */
    private function taxonomy(): array
    {
        /** @var list<array{slug: string, name: string, description?: string|null, theme_config?: array<string, string>}> $taxonomy */
        $taxonomy = array_values((array) config('catalog.categories', []));

        return $taxonomy;
    }

    /**
     * product slug → category slug, exactly as the fixture manifest declares it.
     *
     * @return array<string, string>
     */
    private function shippedMapping(): array
    {
        /** @var list<array{slug: string, category?: string|null}> $entries */
        $entries = array_values((array) config('media_ingest.entries', []));
        $mapping = [];

        foreach ($entries as $entry) {
            if (isset($entry['category'])) {
                $mapping[$entry['slug']] = (string) $entry['category'];
            }
        }

        return $mapping;
    }

    /**
     * Identity plus the shelf of every row, for the "nothing moved" assertion.
     *
     * @return array<int, array<string, mixed>>
     */
    private function rowSnapshot(): array
    {
        return Product::query()
            ->orderBy('id')
            ->get(['id', 'slug', 'category_id'])
            ->map(fn (Product $product): array => [
                'id' => $product->id,
                'slug' => $product->slug,
                'category_id' => $product->category_id,
            ])
            ->all();
    }
}
