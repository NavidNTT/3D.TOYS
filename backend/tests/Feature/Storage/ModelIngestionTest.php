<?php

namespace Tests\Feature\Storage;

use App\Models\Product;
use App\Models\ProductMedia3D;
use Illuminate\Console\Command;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Guards `php artisan toys:ingest-3d`.
 *
 * The command is the one place that copies the repository's GLB fixtures into
 * canonical object storage, so the assertions here are about its promises, not
 * its implementation:
 *
 *  - what it uploads is byte-for-byte what it read (the round-trip hash check
 *    has to actually fail the run when the bytes differ),
 *  - re-running changes nothing,
 *  - it refuses to quietly skip a fixture nobody listed,
 *  - the products it creates carry no invented money, and
 *  - a byte-identical duplicate is tolerated while a divergent one is not.
 *
 * The disk is faked (`Storage::fake`), so no test here needs MinIO, and none of
 * them touches the development database.
 */
class ModelIngestionTest extends TestCase
{
    use RefreshDatabase;

    /** Directory holding this test's generated fixtures. */
    private string $fixtures;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fixtures = sys_get_temp_dir().'/3toys-ingest-'.uniqid('', true);
        mkdir($this->fixtures);

        Storage::fake('s3');
    }

    protected function tearDown(): void
    {
        if (is_dir($this->fixtures)) {
            foreach (glob($this->fixtures.'/*') ?: [] as $file) {
                unlink($file);
            }

            rmdir($this->fixtures);
        }

        parent::tearDown();
    }

    public function test_it_uploads_each_fixture_and_maps_it_to_a_published_unpriced_product(): void
    {
        Queue::fake();

        $this->writeFixture('robot.glb', $this->glb('robot'));
        $this->useManifest([
            [
                'slug' => 'robot-toy',
                'title' => 'Robot Toy',
                'sku' => 'TOY-3D-ROBOT',
                'description' => 'A robot.',
                'sources' => ['robot.glb' => 'models/robot.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::SUCCESS);

        // The stored object is the source file, byte for byte.
        $this->assertSame(
            file_get_contents($this->fixtures.'/robot.glb'),
            Storage::disk('s3')->get('models/robot.glb'),
        );

        $product = Product::query()->where('slug', 'robot-toy')->firstOrFail();

        $this->assertSame('Robot Toy', $product->title);
        $this->assertSame('TOY-3D-ROBOT', $product->sku);
        $this->assertTrue($product->is_active);
        $this->assertSame(0, $product->stock);

        // The money contract: published, but with no chargeable amount and no
        // legacy currency in sight.
        $this->assertSame('IRT', $product->currency);
        $this->assertNull($product->price);
        $this->assertNull($product->compare_at_price);
        $this->assertNull($product->legacy_price);
        $this->assertFalse($product->purchasable());

        $media = ProductMedia3D::query()->where('product_id', $product->id)->firstOrFail();

        $this->assertSame('models/robot.glb', $media->original_file_url);
        $this->assertNull($media->optimized_file_url);
        $this->assertSame((int) filesize($this->fixtures.'/robot.glb'), $media->file_size);

        // Storing an object key must not queue Draco: the fixture is not on the
        // local ingest disk, so that job could only fail.
        Queue::assertNothingPushed();

        // …and the API hands the browser the bucket key through the public
        // endpoint, never the Docker-internal hostname.
        $response = $this->getJson('/api/v1/products/robot-toy');

        $response->assertOk()
            ->assertJsonPath('data.purchasable', false)
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.currency', 'IRT')
            ->assertJsonPath('data.media_3d.format', 'glb');

        $url = (string) $response->json('data.media_3d.url');

        $this->assertStringContainsString('models/robot.glb', $url);
        $this->assertStringNotContainsString('minio:9000', $url);
    }

    public function test_a_dry_run_uploads_nothing_and_writes_nothing(): void
    {
        $this->writeFixture('robot.glb', $this->glb('robot'));
        $this->useManifest([
            [
                'slug' => 'robot-toy',
                'title' => 'Robot Toy',
                'sku' => 'TOY-3D-ROBOT',
                'description' => 'A robot.',
                'sources' => ['robot.glb' => 'models/robot.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d', ['--dry-run' => true])->assertExitCode(Command::SUCCESS);

        $this->assertSame([], Storage::disk('s3')->allFiles());
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, ProductMedia3D::query()->count());
    }

    public function test_rerunning_the_ingestion_is_idempotent(): void
    {
        $this->writeFixture('robot.glb', $this->glb('robot'));
        $this->useManifest([
            [
                'slug' => 'robot-toy',
                'title' => 'Robot Toy',
                'sku' => 'TOY-3D-ROBOT',
                'description' => 'A robot.',
                'sources' => ['robot.glb' => 'models/robot.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::SUCCESS);
        $firstId = Product::query()->where('slug', 'robot-toy')->value('id');
        $firstMediaId = ProductMedia3D::query()->value('id');

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::SUCCESS);

        $this->assertSame(1, Product::query()->count());
        $this->assertSame(1, ProductMedia3D::query()->count());
        $this->assertSame($firstId, Product::query()->where('slug', 'robot-toy')->value('id'));
        $this->assertSame($firstMediaId, ProductMedia3D::query()->value('id'));
        $this->assertSame(['models/robot.glb'], Storage::disk('s3')->allFiles());
    }

    public function test_it_refuses_to_run_while_a_fixture_is_unaccounted_for(): void
    {
        $this->writeFixture('robot.glb', $this->glb('robot'));
        $this->writeFixture('surprise.glb', $this->glb('surprise'));
        $this->useManifest([
            [
                'slug' => 'robot-toy',
                'title' => 'Robot Toy',
                'sku' => 'TOY-3D-ROBOT',
                'description' => 'A robot.',
                'sources' => ['robot.glb' => 'models/robot.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::FAILURE);

        $this->assertSame([], Storage::disk('s3')->allFiles());
        $this->assertSame(0, Product::query()->count());
    }

    public function test_two_sources_for_one_product_must_be_byte_identical(): void
    {
        $this->writeFixture('original.glb', $this->glb('original'));
        $this->writeFixture('duplicate.glb', $this->glb('duplicate'));
        $this->useManifest([
            [
                'slug' => 'robot-toy',
                'title' => 'Robot Toy',
                'sku' => 'TOY-3D-ROBOT',
                'description' => 'A robot.',
                'sources' => [
                    'original.glb' => 'models/original.glb',
                    'duplicate.glb' => 'models/duplicate.glb',
                ],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::FAILURE);

        $this->assertSame(0, Product::query()->count());
    }

    public function test_a_byte_identical_duplicate_is_preserved_under_its_own_key(): void
    {
        $bytes = $this->glb('twin');
        $this->writeFixture('twin.glb', $bytes);
        $this->writeFixture('twin (1).glb', $bytes);
        $this->useManifest([
            [
                'slug' => 'twin-toy',
                'title' => 'Twin Toy',
                'sku' => 'TOY-3D-TWIN',
                'description' => 'A twin.',
                'sources' => [
                    'twin.glb' => 'models/twin.glb',
                    'twin (1).glb' => 'models/twin_1.glb',
                ],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::SUCCESS);

        Storage::disk('s3')->assertExists('models/twin.glb');
        Storage::disk('s3')->assertExists('models/twin_1.glb');

        // The product maps to the first source; the copy is preserved but not
        // advertised as a second asset.
        $media = ProductMedia3D::query()->firstOrFail();

        $this->assertSame('models/twin.glb', $media->original_file_url);
        $this->assertSame(1, Product::query()->count());
    }

    public function test_the_optimized_rendition_is_recorded_and_its_size_is_the_served_size(): void
    {
        $this->writeFixture('car.glb', $this->glb('car'));
        $this->writeFixture('car_opt.glb', $this->glb('smaller'));
        $this->useManifest([
            [
                'slug' => 'car-model',
                'title' => 'Car Model',
                'sku' => 'TOY-3D-CAR',
                'description' => 'A car.',
                'sources' => ['car.glb' => 'models/car.glb'],
                'optimized' => ['car_opt.glb' => 'models/car_opt.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::SUCCESS);

        $media = ProductMedia3D::query()->firstOrFail();

        $this->assertSame('models/car.glb', $media->original_file_url);
        $this->assertSame('models/car_opt.glb', $media->optimized_file_url);
        $this->assertSame((int) filesize($this->fixtures.'/car_opt.glb'), $media->file_size);

        // The viewer streams the optimized file, so that is the URL the API
        // publishes — through the browser-facing endpoint, never the
        // Docker-internal one.
        $url = (string) $this->getJson('/api/v1/products/car-model')
            ->assertOk()
            ->json('data.media_3d.url');

        $this->assertStringContainsString('models/car_opt.glb', $url);
        $this->assertStringNotContainsString('minio:9000', $url);
    }

    public function test_it_rejects_a_file_that_is_not_a_well_formed_glb(): void
    {
        file_put_contents($this->fixtures.'/broken.glb', '<html>not a model</html>');
        $this->useManifest([
            [
                'slug' => 'broken-toy',
                'title' => 'Broken Toy',
                'sku' => 'TOY-3D-BROKEN',
                'description' => 'Broken.',
                'sources' => ['broken.glb' => 'models/broken.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::FAILURE);

        $this->assertSame([], Storage::disk('s3')->allFiles());
        $this->assertSame(0, Product::query()->count());
    }

    public function test_it_rejects_a_truncated_glb_container(): void
    {
        // A valid header whose declared length does not match the file size:
        // exactly the shape a half-finished download has.
        file_put_contents(
            $this->fixtures.'/cut.glb',
            'glTF'.pack('V', 2).pack('V', 4096).'JSON',
        );

        $this->useManifest([
            [
                'slug' => 'cut-toy',
                'title' => 'Cut Toy',
                'sku' => 'TOY-3D-CUT',
                'description' => 'Cut.',
                'sources' => ['cut.glb' => 'models/cut.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::FAILURE);

        $this->assertSame(0, Product::query()->count());
    }

    public function test_it_leaves_legacy_usd_rows_and_their_media_untouched(): void
    {
        $legacy = Product::factory()->create([
            'slug' => 'legacy-usd',
            'title' => 'Legacy USD Toy',
            'price' => null,
            'compare_at_price' => null,
            'currency' => 'USD',
        ]);

        DB::table('products')->where('id', $legacy->id)->update([
            'legacy_price' => 12.99,
            'legacy_currency' => 'USD',
            'legacy_price_preserved_at' => now(),
        ]);

        ProductMedia3D::withoutEvents(fn () => ProductMedia3D::query()->create([
            'product_id' => $legacy->id,
            'original_file_url' => 'https://example.test/demo/duck.glb',
            'lighting_preset' => 'studio',
        ]));

        $this->writeFixture('robot.glb', $this->glb('robot'));
        $this->useManifest([
            [
                'slug' => 'robot-toy',
                'title' => 'Robot Toy',
                'sku' => 'TOY-3D-ROBOT',
                'description' => 'A robot.',
                'sources' => ['robot.glb' => 'models/robot.glb'],
            ],
        ]);

        $this->artisan('toys:ingest-3d')->assertExitCode(Command::SUCCESS);

        $after = Product::query()->findOrFail($legacy->id);

        $this->assertNull($after->price);
        $this->assertSame('USD', $after->currency);
        $this->assertFalse($after->purchasable());
        $this->assertSame('12.99', $after->legacyAmount('price'));

        // The external demo URL is preserved verbatim, not rewritten to a
        // bucket key.
        $this->assertSame(
            'https://example.test/demo/duck.glb',
            ProductMedia3D::query()->where('product_id', $legacy->id)->value('original_file_url'),
        );

        // No legacy amount leaked onto the new row either.
        $this->assertNull(Product::query()->where('slug', 'robot-toy')->value('legacy_price'));
    }

    public function test_the_shipped_manifest_is_coherent_and_carries_no_money(): void
    {
        /** @var list<array<string, mixed>> $entries */
        $entries = (array) (require base_path('config/media_ingest.php'))['entries'];

        $this->assertCount(8, $entries, 'The repository ships eight 3D fixtures as products.');

        $slugs = [];
        $skus = [];
        $keys = [];
        $fixtures = 0;

        foreach ($entries as $entry) {
            $this->assertNotEmpty($entry['slug']);
            $this->assertNotEmpty($entry['title']);
            $this->assertNotEmpty($entry['description']);

            // A manifest entry can never introduce money: neither a price, nor
            // a legacy amount, nor a currency. Those live in the database and
            // are decided by a human.
            $this->assertArrayNotHasKey('price', $entry);
            $this->assertArrayNotHasKey('currency', $entry);
            $this->assertArrayNotHasKey('legacy_price', $entry);

            $slugs[] = $entry['slug'];
            $skus[] = $entry['sku'];

            /** @var array<string, string> $sources */
            $sources = $entry['sources'];
            /** @var array<string, string> $optimized */
            $optimized = $entry['optimized'] ?? [];

        $this->assertNotEmpty($sources, "Entry {$entry['slug']} lists no source.");

        $all = [...array_keys($sources), ...array_keys($optimized)];

            foreach ($all as $file) {
                $this->assertStringEndsWith('.glb', $file);
                $fixtures++;
            }

            foreach ([...array_values($sources), ...array_values($optimized)] as $key) {
                $this->assertStringStartsWith('models/', $key);
                $this->assertStringEndsWith('.glb', $key);
                $keys[] = $key;
            }
        }

        $this->assertSame(10, $fixtures, 'Every one of the ten fixture files must be accounted for.');
        $this->assertSame(count($slugs), count(array_unique($slugs)), 'Slugs must be unique.');
        $this->assertSame(count($skus), count(array_unique($skus)), 'SKUs must be unique.');
        $this->assertSame(count($keys), count(array_unique($keys)), 'Object keys must be unique.');
    }

    /**
     * Replace the config manifest with a test-sized one.
     *
     * @param  list<array<string, mixed>>  $entries
     */
    private function useManifest(array $entries): void
    {
        config()->set('media_ingest.entries', $entries);
        config()->set('media_ingest.source', $this->fixtures);
    }

    private function writeFixture(string $name, string $bytes): void
    {
        file_put_contents($this->fixtures.'/'.$name, $bytes);
    }

    /**
     * A minimal but genuinely well-formed binary glTF container: 12-byte header
     * (magic, version 2, total length) followed by one JSON chunk. The command
     * validates exactly that structure, so a fixture has to satisfy it to prove
     * anything.
     */
    private function glb(string $tag): string
    {
        $json = json_encode(['asset' => ['version' => '2.0'], 'extras' => ['tag' => $tag]]);
        $json = is_string($json) ? $json : '{}';
        $json .= str_repeat(' ', (4 - (strlen($json) % 4)) % 4);

        $chunk = pack('V', strlen($json)).'JSON'.$json;
        $total = 12 + strlen($chunk);

        return 'glTF'.pack('V', 2).pack('V', $total).$chunk;
    }
}
