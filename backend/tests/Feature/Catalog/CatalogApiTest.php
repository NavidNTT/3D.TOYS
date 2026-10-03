<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductMedia3D;
use App\Services\Catalog\CatalogService;
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
            'title' => 'Visible Toy',
            'slug' => 'visible-toy',
            'is_active' => true,
        ]);
        Product::factory()->inactive()->create(['slug' => 'hidden-toy']);

        $response = $this->getJson(self::PRODUCTS);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'visible-toy')
            ->assertJsonPath('data.data.0.category.slug', $category->slug);
    }

    public function test_a_product_exposes_money_as_numbers_and_media_as_an_absolute_url(): void
    {
        $product = Product::factory()->pricedAt(1_299_000)->create([
            'slug' => 'duck',
            'compare_at_price' => 1_699_000,
            'stock' => 7,
        ]);

        // Written quietly: seeding/creating a fixture must not queue the Draco
        // job, which expects a real file on the public disk.
        ProductMedia3D::withoutEvents(fn () => ProductMedia3D::query()->create([
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

        $this->assertIsInt($response->json('data.price'));
        $this->assertIsInt($response->json('data.compare_at_price'));
        $this->assertStringContainsString('/storage/models/3d/duck.glb', $response->json('data.media_3d.url'));
    }

    public function test_a_product_without_a_stored_model_reports_no_media(): void
    {
        $product = Product::factory()->create(['slug' => 'no-model']);

        ProductMedia3D::withoutEvents(fn () => ProductMedia3D::query()->create([
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

    public function test_the_product_list_is_paginated_inside_the_shared_envelope(): void
    {
        Product::factory()->count(30)->create();

        $response = $this->getJson(self::PRODUCTS);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(CatalogService::DEFAULT_PER_PAGE, 'data.data')
            ->assertJsonPath('data.meta.per_page', CatalogService::DEFAULT_PER_PAGE)
            ->assertJsonPath('data.meta.total', 30)
            ->assertJsonPath('data.meta.current_page', 1)
            ->assertJsonPath('data.meta.last_page', 2)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'data',
                    'meta' => ['current_page', 'per_page', 'last_page', 'total', 'from', 'to'],
                    'links' => ['first', 'prev', 'next', 'last'],
                ],
            ]);
    }

    public function test_a_client_can_choose_a_page_and_page_size(): void
    {
        Product::factory()->count(12)->create();

        $this->getJson(self::PRODUCTS.'?per_page=5&page=2')
            ->assertOk()
            ->assertJsonCount(5, 'data.data')
            ->assertJsonPath('data.meta.current_page', 2)
            ->assertJsonPath('data.meta.per_page', 5)
            ->assertJsonPath('data.meta.last_page', 3)
            ->assertJsonPath('data.meta.total', 12);
    }

    public function test_per_page_is_capped_at_the_documented_ceiling(): void
    {
        $this->getJson(self::PRODUCTS.'?per_page='.(CatalogService::MAX_PER_PAGE + 1))
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonStructure(['success', 'message', 'data' => ['per_page']]);
    }

    public function test_it_searches_the_title_case_insensitively(): void
    {
        Product::factory()->create(['title' => 'Wooden Train Deluxe', 'slug' => 'wooden-train-deluxe']);
        Product::factory()->create(['title' => 'Plush Bear', 'slug' => 'plush-bear']);

        $this->getJson(self::PRODUCTS.'?search=TRAIN')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'wooden-train-deluxe');
    }

    public function test_it_searches_persian_titles_and_bridges_arabic_look_alike_letters(): void
    {
        // Stored with the Persian keheh (U+06A9).
        Product::factory()->create(['title' => 'کتاب تصویری', 'slug' => 'picture-book']);
        Product::factory()->create(['title' => 'ماشین کنترلی', 'slug' => 'rc-car']);

        // The customer types the Arabic kaf (U+0643) instead: identical on
        // screen, a different code point. Normalisation has to bridge them.
        $this->getJson(self::PRODUCTS.'?search='.urlencode('كتاب'))
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'picture-book');

        // …and the ZWNJ inside a compound word must not break the match either.
        $this->getJson(self::PRODUCTS.'?search='.urlencode('ماشین'))
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'rc-car');
    }

    public function test_it_filters_by_category_slug_and_by_stock(): void
    {
        $robots = Category::factory()->create(['slug' => 'robots', 'name' => 'Robots']);
        $dolls = Category::factory()->create(['slug' => 'dolls', 'name' => 'Dolls']);

        Product::factory()->create(['category_id' => $robots->id, 'slug' => 'robot-a', 'stock' => 3]);
        Product::factory()->outOfStock()->create(['category_id' => $robots->id, 'slug' => 'robot-b']);
        Product::factory()->create(['category_id' => $dolls->id, 'slug' => 'doll-a', 'stock' => 5]);

        $this->getJson(self::PRODUCTS.'?category=robots')
            ->assertOk()
            ->assertJsonCount(2, 'data.data');

        $this->getJson(self::PRODUCTS.'?category=robots&in_stock=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'robot-a');

        $this->getJson(self::PRODUCTS.'?in_stock=1')
            ->assertOk()
            ->assertJsonCount(2, 'data.data');
    }

    public function test_search_and_filters_still_apply_the_published_rule(): void
    {
        Product::factory()->create(['title' => 'Trail Blazer 4x4', 'slug' => 'trail-blazer']);
        Product::factory()->inactive()->create(['title' => 'Trail Blazer Draft', 'slug' => 'trail-blazer-draft']);

        $this->getJson(self::PRODUCTS.'?search=trail')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.slug', 'trail-blazer');
    }

    public function test_an_overlong_search_term_is_rejected(): void
    {
        $this->getJson(self::PRODUCTS.'?search='.urlencode(str_repeat('ا', 101)))
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonStructure(['success', 'message', 'data' => ['search']]);
    }
}
