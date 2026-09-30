<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Media3d;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The storefront's catalog contract.
 *
 * These endpoints used to answer 404 — the routes did not exist — which made
 * the Next.js home page fail hard with "Failed to load the product catalog
 * (HTTP 404)". The tests below pin down both the status codes and the exact
 * payload shape the frontend types expect (frontend/src/types/product.ts), so
 * a future refactor cannot break rendering without failing here first.
 */
class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    private const CATEGORIES = '/api/v1/categories';
    private const PRODUCTS = '/api/v1/products';

    public function test_the_category_list_is_public_and_returns_the_storefront_shape(): void
    {
        Category::factory()->create([
            'name' => 'Bath Toys',
            'slug' => 'bath-toys',
            'theme_config' => ['primary_color' => '#38bdf8'],
        ]);

        $response = $this->getJson(self::CATEGORIES);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.name', 'Bath Toys')
            ->assertJsonPath('data.0.slug', 'bath-toys')
            ->assertJsonPath('data.0.theme_config.primary_color', '#38bdf8');
    }

    public function test_the_product_list_only_contains_published_products(): void
    {
        $category = Category::factory()->create();
        Product::factory()->create([
            'category_id' => $category->id,
            'name' => 'Visible Toy',
            'slug' => 'visible-toy',
            'is_active' => true,
        ]);
        Product::factory()->inactive()->create(['slug' => 'hidden-toy']);

        $response = $this->getJson(self::PRODUCTS);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.slug', 'visible-toy')
            ->assertJsonPath('data.0.category.slug', $category->slug);
    }

    public function test_a_product_exposes_money_as_numbers_and_media_as_an_absolute_url(): void
    {
        $product = Product::factory()->pricedAt(12.99)->create([
            'slug' => 'duck',
            'compare_at_price' => 16.99,
            'stock' => 7,
        ]);

        // Written quietly: seeding/creating a fixture must not queue the Draco
        // job, which expects a real file on the public disk.
        Media3d::withoutEvents(fn () => Media3d::query()->create([
            'product_id' => $product->id,
            'original_file_url' => 'models/3d/duck.glb',
            'lighting_preset' => 'studio',
        ]));

        $response = $this->getJson(self::PRODUCTS.'/duck');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.slug', 'duck')
            ->assertJsonPath('data.media_3d.format', 'glb')
            ->assertJsonPath('data.stock', 7);

        $this->assertIsFloat($response->json('data.price'));
        $this->assertIsFloat($response->json('data.compare_at_price'));
        $this->assertStringContainsString('/storage/models/3d/duck.glb', $response->json('data.media_3d.url'));
    }

    public function test_a_product_without_a_stored_model_reports_no_media(): void
    {
        $product = Product::factory()->create(['slug' => 'no-model']);

        Media3d::withoutEvents(fn () => Media3d::query()->create([
            'product_id' => $product->id,
            'original_file_url' => null,
            'lighting_preset' => 'studio',
        ]));

        $this->getJson(self::PRODUCTS.'/no-model')
            ->assertOk()
            ->assertJsonPath('data.media_3d', null);
    }

    public function test_an_unknown_or_unpublished_slug_answers_404_with_the_json_envelope(): void
    {
        Product::factory()->inactive()->create(['slug' => 'draft-toy']);

        $this->getJson(self::PRODUCTS.'/does-not-exist')
            ->assertNotFound()
            ->assertJsonPath('success', false);

        $this->getJson(self::PRODUCTS.'/draft-toy')->assertNotFound();
    }

    public function test_a_category_without_a_palette_reports_null_and_not_a_missing_key(): void
    {
        Category::factory()->create(['slug' => 'plain', 'name' => 'Plain', 'theme_config' => null]);

        $this->getJson(self::CATEGORIES)
            ->assertOk()
            ->assertJsonPath('data.0.theme_config', null);
    }
}
