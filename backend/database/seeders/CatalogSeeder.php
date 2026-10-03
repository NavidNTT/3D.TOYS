<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductMedia3D;
use Illuminate\Database\Seeder;

/**
 * Demo catalog: categories with their storefront palettes plus a handful of
 * products, one of which carries a working 3D model.
 *
 * Idempotent on purpose — every row is matched by its unique `slug` and
 * updated in place, so `php artisan db:seed --class=CatalogSeeder --force` can
 * be re-run (or run on top of DatabaseSeeder) without creating duplicates or
 * tripping the unique index.
 */
class CatalogSeeder extends Seeder
{
    /**
     * The Khronos sample model, the same public asset the storefront's
     * /products/sample page uses. Shipping a reachable URL with the demo data
     * means a freshly seeded shop can prove the whole 3D path — API → Next.js
     * → WebGL + Draco decoder — before any real upload exists.
     *
     * Replace it through the admin panel (Product → 3D asset) once models are
     * uploaded to MinIO or the public disk.
     */
    private const DEMO_MODEL_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';

    public function run(): void
    {
        $this->seedCategories();
        $this->seedProducts();
    }

    /**
     * Categories, each with the palette the storefront themes its buttons,
     * badges and container glows with (`theme_config`).
     */
    private function seedCategories(): void
    {
        $categories = [
            [
                'name' => 'Bath Toys',
                'slug' => 'bath-toys',
                'description' => 'Floating, squeaking and endlessly splash-proof.',
                'theme_config' => [
                    'primary_color' => '#38bdf8',
                    'glow_color' => '#0ea5e9',
                    'accent_color' => '#e0f2fe',
                    'background_color' => '#0b1020',
                ],
            ],
            [
                'name' => 'Building Blocks',
                'slug' => 'building-blocks',
                'description' => 'Interlocking sets that scale from a tower to a city.',
                'theme_config' => [
                    'primary_color' => '#f59e0b',
                    'glow_color' => '#fbbf24',
                    'accent_color' => '#fde68a',
                    'background_color' => '#1a1206',
                ],
            ],
            [
                'name' => 'Collectible Figures',
                'slug' => 'collectible-figures',
                'description' => 'Hand-finished figures for the shelf, not the floor.',
                'theme_config' => [
                    'primary_color' => '#a78bfa',
                    'glow_color' => '#8b5cf6',
                    'accent_color' => '#ddd6fe',
                    'background_color' => '#120b24',
                ],
            ],
            [
                'name' => 'Remote Control',
                'slug' => 'remote-control',
                'description' => 'Motorised toys with real suspensions and real batteries.',
                'theme_config' => [
                    'primary_color' => '#34d399',
                    'glow_color' => '#10b981',
                    'accent_color' => '#d1fae5',
                    'background_color' => '#04170f',
                ],
            ],
        ];

        foreach ($categories as $category) {
            Category::query()->updateOrCreate(
                ['slug' => $category['slug']],
                $category,
            );
        }
    }

    /**
     * Products. `$definition['category']` holds the category *slug*, so the
     * data below stays readable and ids are resolved at seed time.
     *
     * Prices are whole Toman (the column is an integer, and one Toman is the
     * smallest unit). The amounts below are the same numbers the demo USD
     * catalog was converted to by the `consolidate_products_columns`
     * migration, so re-seeding is idempotent with an already-migrated database.
     */
    private function seedProducts(): void
    {
        $products = [
            [
                'slug' => 'rubber-duck-classic-bath-toy',
                'category' => 'bath-toys',
                'title' => 'Rubber Duck — Classic Bath Toy',
                'sku' => 'TOY-DUCK-001',
                'description' => 'A timeless floating companion, rendered live in 3D. Inspect every angle in the viewer — what you spin is what ships.',
                'price' => 1_299_000,
                'compare_at_price' => 1_699_000,
                'stock' => 42,
                'attributes' => [
                    'Material' => 'Non-toxic ABS + plush',
                    'Dimensions' => '18 × 12 × 10 cm',
                    'Age range' => '3+ years',
                    'Weight' => '320 g',
                ],
                // The only seeded product with a real model, so the 3D viewer
                // can be demonstrated end-to-end straight after seeding.
                'model_url' => self::DEMO_MODEL_URL,
                'lighting_preset' => 'studio',
                'camera_settings' => [
                    'position' => [4, 3, 6],
                    'target' => [0, 0.5, 0],
                    'fov' => 40,
                    'min_distance' => 2.5,
                    'max_distance' => 12,
                    'auto_rotate_speed' => 1.2,
                ],
            ],
            [
                'slug' => 'splash-squad-submarine',
                'category' => 'bath-toys',
                'title' => 'Splash Squad Submarine',
                'sku' => 'TOY-SUB-002',
                'description' => 'Bath-time exploration vessel with a spinning propeller and a watertight crew hatch.',
                'price' => 1_850_000,
                'compare_at_price' => null,
                'stock' => 25,
                'attributes' => [
                    'Material' => 'Recycled ABS',
                    'Age range' => '4+ years',
                ],
            ],
            [
                'slug' => 'interlocking-blocks-500',
                'category' => 'building-blocks',
                'title' => 'Interlocking Blocks — 500 Piece Set',
                'sku' => 'TOY-BLK-500',
                'description' => 'Five hundred precision-moulded blocks with a 0.02 mm tolerance, so towers actually stay towers.',
                'price' => 6_400_000,
                'compare_at_price' => 7_900_000,
                'stock' => 12,
                'attributes' => [
                    'Pieces' => 500,
                    'Material' => 'ABS',
                    'Age range' => '5+ years',
                ],
            ],

            [
                'slug' => 'magnetic-tiles-starter-100',
                'category' => 'building-blocks',
                'title' => 'Magnetic Tiles — 100 Piece Starter',
                'sku' => 'TOY-MAG-100',
                'description' => 'Translucent magnetic tiles for two-dimensional thinkers who are not ready to read instructions.',
                'price' => 4_825_000,
                'compare_at_price' => null,
                'stock' => 30,
                'attributes' => [
                    'Pieces' => 100,
                    'Magnets' => 'Rare-earth, fully sealed',
                    'Age range' => '3+ years',
                ],
            ],
            [
                'slug' => 'astronaut-figure-seraph',
                'category' => 'collectible-figures',
                'title' => 'Astronaut Figure — SERAPH Edition',
                'sku' => 'TOY-FIG-009',
                'description' => 'Hand-finished resin figure on a weighted base, numbered on the underside.',
                'price' => 12_900_000,
                'compare_at_price' => null,
                'stock' => 4,
                'attributes' => [
                    'Scale' => '1:12',
                    'Material' => 'Resin',
                    'Edition' => 'Numbered, 500 units',
                ],
            ],
            [
                'slug' => 'trail-blazer-4x4',
                'category' => 'remote-control',
                'title' => 'Trail Blazer 4x4 Rock Crawler',
                'sku' => 'TOY-RC-014',
                'description' => 'Two-speed gearbox, oil-filled shocks and a 40 minute run time on rough terrain.',
                // Deliberately out of stock: the storefront's "Sold out" badge
                // and the disabled checkout button are part of the demo.
                'price' => 18_999_000,
                'compare_at_price' => 21_999_000,
                'stock' => 0,
                'attributes' => [
                    'Scale' => '1:10',
                    'Runtime' => '40 minutes',
                    'Top speed' => '28 km/h',
                ],
            ],
        ];

        foreach ($products as $definition) {
            $category = Category::query()->where('slug', $definition['category'])->first();

            $product = Product::query()->updateOrCreate(
                ['slug' => $definition['slug']],
                [
                    'category_id' => $category?->id,
                    // `title` is the single name column; the duplicated `name`
                    // column and the hook that mirrored it were removed.
                    'title' => $definition['title'],
                    'sku' => $definition['sku'],
                    'description' => $definition['description'],
                    // Whole Toman, matching the column type.
                    'price' => $definition['price'],
                    'compare_at_price' => $definition['compare_at_price'],
                    'currency' => 'IRT',
                    'stock' => $definition['stock'],
                    // `is_active` replaced the retired three-state `status`
                    // column; this is the flag the storefront reads.
                    'is_active' => true,
                    'attributes' => $definition['attributes'],
                ],
            );

            if (isset($definition['model_url'])) {
                $this->seedMedia($product, $definition);
            }
        }
    }

    /**
     * Attach the 3D asset and its viewer settings to a product.
     *
     * Wrapped in `withoutEvents()` deliberately. `ProductMedia3D` (through its
     * observer) dispatches `Optimize3DModelJob` the moment `original_file_url`
     * is set, and that job expects a real file on the `public` disk: dispatch it
     * for a fixture pointing at a remote demo URL and the queue can only fail,
     * filling `failed_jobs` on every fresh install. Fixtures are written
     * quietly; only real uploads (admin panel, importer) go through the Draco
     * pipeline.
     *
     * @param  array<string, mixed>  $definition
     */
    private function seedMedia(Product $product, array $definition): void
    {
        ProductMedia3D::withoutEvents(function () use ($product, $definition): void {
            ProductMedia3D::query()->updateOrCreate(
                ['product_id' => $product->id],
                [
                    'original_file_url' => $definition['model_url'],
                    // Nothing optimised yet — set once the model is uploaded
                    // through the admin panel and the worker has run.
                    'optimized_file_url' => null,
                    'thumbnail_url' => null,
                    'lighting_preset' => $definition['lighting_preset'] ?? 'studio',
                    'camera_settings' => $definition['camera_settings'] ?? null,
                    'auto_rotate' => true,
                    'rotation_speed' => 1.0,
                ],
            );
        });
    }
}
