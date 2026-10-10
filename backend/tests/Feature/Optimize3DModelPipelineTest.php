<?php

namespace Tests\Feature;

use App\Http\Resources\Media3DResource;
use App\Jobs\Optimize3DModelJob;
use App\Models\Product;
use App\Models\ProductMedia3D;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class Optimize3DModelPipelineTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> Stand-in optimizer scripts created by a test. */
    private array $fakeOptimizers = [];

    protected function tearDown(): void
    {
        foreach ($this->fakeOptimizers as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }

        $this->fakeOptimizers = [];

        parent::tearDown();
    }

    public function test_product_media_3d_creation_dispatches_optimize_job(): void
    {
        Queue::fake();

        $product = Product::factory()->create();

        $media = ProductMedia3D::create([
            'product_id' => $product->id,
            'original_file_url' => 'models/3d/sample.glb',
        ]);

        Queue::assertPushed(Optimize3DModelJob::class, fn ($job) => $job->productMedia3DId === $media->id);
    }

    public function test_product_media_3d_update_without_file_change_does_not_dispatch(): void
    {
        Queue::fake();

        $product = Product::factory()->create();

        $media = ProductMedia3D::create([
            'product_id' => $product->id,
            'original_file_url' => 'models/3d/sample.glb',
        ]);

        Queue::assertPushed(Optimize3DModelJob::class, 1);

        // Reset the fake (clear recorded pushes) then touch a non-file column.
        Queue::fake();

        $media->update(['lighting_preset' => 'sunset']);

        Queue::assertNotPushed(Optimize3DModelJob::class);
    }

    public function test_job_throws_when_source_file_missing(): void
    {
        $this->neutralizeHostEnvironment();

        // The ingest disk is the canonical MinIO disk, so that is where a
        // missing original has to be reported.
        Storage::fake('s3');

        $media = $this->mediaFor('models/3d/missing.glb');

        try {
            (new Optimize3DModelJob($media->id))->handle();
            $this->fail('Expected RuntimeException for missing source file.');
        } catch (\RuntimeException $e) {
            $this->assertMatchesRegularExpression('/not found/i', $e->getMessage());
            $this->assertStringContainsString('s3', $e->getMessage());
        }
    }

    /**
     * The whole point of the streaming refactor: a model that lives in object
     * storage is pulled down, optimized against real local paths, and pushed
     * back — and what lands in the bucket is byte-for-byte what the CLI wrote.
     */
    public function test_optimization_streams_through_temp_files_into_object_storage(): void
    {
        $this->neutralizeHostEnvironment();

        Storage::fake('s3');

        $source = $this->glbBytes('robot');
        Storage::disk('s3')->put('models/3d/robot.glb', $source);

        $media = $this->mediaFor('models/3d/robot.glb');

        $optimizerOutput = 'OPTIMIZED:'.substr($source, 0, 64);

        config([
            'models3d.binary' => $this->fakeOptimizer($optimizerOutput),
            'models3d.output_directory' => 'models/3d/optimized',
        ]);

        (new Optimize3DModelJob($media->id))->handle();

        $media->refresh();

        // The recorded key is a bare object key, not a `/storage/…` path…
        $this->assertSame('models/3d/optimized/robot_opt.glb', $media->optimized_file_url);

        // …the bytes in the bucket are exactly the CLI's output…
        Storage::disk('s3')->assertExists('models/3d/optimized/robot_opt.glb');
        $this->assertSame($optimizerOutput, Storage::disk('s3')->get('models/3d/optimized/robot_opt.glb'));

        // …and the served size is the size read back from the disk.
        $this->assertSame(strlen($optimizerOutput), (int) $media->file_size);

        // …and the viewer URL resolves through MinIO, never the internal host.
        $url = (string) Media3DResource::urlFor($media);

        $this->assertStringContainsString('models/3d/optimized/robot_opt.glb', $url);
        $this->assertStringNotContainsString('minio:9000', $url);

        // The scratch directory does not survive the run — a failed job cannot
        // leave a multi-megabyte model behind in the system temp directory.
        $this->assertSame([], glob(sys_get_temp_dir().'/3toys-optimize-*') ?: []);
    }

    /**
     * Declares itself a stale result rather than overwriting the original.
     */
    public function test_a_failed_optimization_leaves_the_row_and_the_workspace_clean(): void
    {
        $this->neutralizeHostEnvironment();

        Storage::fake('s3');
        Storage::disk('s3')->put('models/3d/robot.glb', $this->glbBytes('robot'));

        $media = $this->mediaFor('models/3d/robot.glb');

        // A binary that cannot run: the job must fail loudly, record nothing,
        // and still clean up its temp files.
        config(['models3d.binary' => '"'.PHP_BINARY.'" -r "exit(3);"']);

        try {
            (new Optimize3DModelJob($media->id))->handle();
            $this->fail('Expected RuntimeException when the optimizer fails.');
        } catch (\RuntimeException $e) {
            $this->assertMatchesRegularExpression('/gltf-transform failed/i', $e->getMessage());
        }

        $media->refresh();

        $this->assertNull($media->optimized_file_url);
        Storage::disk('s3')->assertMissing('models/3d/optimized/robot_opt.glb');
        $this->assertSame([], glob(sys_get_temp_dir().'/3toys-optimize-*') ?: []);
    }

    public function test_job_config_matches_requirements(): void
    {
        $job = new Optimize3DModelJob(1);

        $this->assertSame('redis', $job->connection);
        $this->assertSame(120, $job->timeout);
        $this->assertSame(2, $job->tries);
        $this->assertInstanceOf(ShouldQueue::class, $job);
    }

    public function test_artisan_command_is_registered(): void
    {
        $this->artisan('toys:optimize-3d', ['--help' => true])
            ->assertSuccessful();
    }

    /**
     * `handle()` boots the Storage/Log managers, which resolve the default
     * cache store from the environment at boot time. The dev shell exports
     * CACHE_STORE=redis / REDIS_* (docker-compose) and LOG_CHANNEL=stderr,
     * while the php-redis extension is not installed on every host. Neutralize
     * both so nothing touches Redis.
     */
    private function neutralizeHostEnvironment(): void
    {
        putenv('CACHE_STORE=array');
        $_ENV['CACHE_STORE'] = 'array';
        $_SERVER['CACHE_STORE'] = 'array';
        putenv('LOG_CHANNEL=single');
        $_ENV['LOG_CHANNEL'] = 'single';
        $_SERVER['LOG_CHANNEL'] = 'single';
        config(['cache.default' => 'array', 'logging.default' => 'single']);
    }

    /**
     * A media row pointing at a key on the ingest disk.
     *
     * Created without events: the `created` observer would dispatch the job
     * onto the redis queue (the job's connection), which needs a live server.
     * `handle()` is invoked directly instead.
     */
    private function mediaFor(string $key): ProductMedia3D
    {
        $product = Product::factory()->create();

        return ProductMedia3D::withoutEvents(fn () => ProductMedia3D::forceCreate([
            'product_id' => $product->id,
            'original_file_url' => $key,
        ]));
    }

    /**
     * A stand-in for the `gltf-transform` binary.
     *
     * It writes a fixed payload to the output path the real CLI would use, so
     * the streaming half of the job — pull down, run, push back, read the size
     * back — is exercised for real instead of being mocked away. The payload is
     * base64-encoded to keep quoting out of the generated script.
     *
     * @return string The `models3d.binary` value to run it.
     */
    private function fakeOptimizer(string $output): string
    {
        $path = rtrim(sys_get_temp_dir(), '/\\').'/3toys-fake-optimizer-'.bin2hex(random_bytes(6)).'.php';

        $payload = base64_encode($output);

        file_put_contents(
            $path,
            "<?php\n// Stand-in for the gltf-transform CLI.\n"
            ."file_put_contents(\$argv[3], base64_decode('{$payload}'));\n",
        );

        $this->fakeOptimizers[] = $path;

        return '"'.str_replace('"', '', PHP_BINARY).'" '.escapeshellarg($path);
    }

    /**
     * A minimal well-formed binary glTF container, for realistic input bytes.
     */
    private function glbBytes(string $tag): string
    {
        $json = json_encode(['asset' => ['version' => '2.0'], 'extras' => ['tag' => $tag]]);
        $json = is_string($json) ? $json : '{}';
        $json .= str_repeat(' ', (4 - (strlen($json) % 4)) % 4);

        $chunk = pack('V', strlen($json)).'JSON'.$json;

        return 'glTF'.pack('V', 2).pack('V', 12 + strlen($chunk)).$chunk;
    }
}
