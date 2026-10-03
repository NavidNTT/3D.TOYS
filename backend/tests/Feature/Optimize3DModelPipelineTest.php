<?php

namespace Tests\Feature;

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
        // `handle()` boots the Storage/Log managers, which resolve the
        // default cache store from the environment at boot time. The dev
        // shell exports CACHE_STORE=redis / REDIS_* (docker-compose), and
        // the php-redis extension is not installed on this host — while
        // LOG_CHANNEL=stderr is also inherited. Neutralize all of these
        // for this unit so nothing touches Redis.
        putenv('CACHE_STORE=array');
        $_ENV['CACHE_STORE'] = 'array';
        $_SERVER['CACHE_STORE'] = 'array';
        putenv('LOG_CHANNEL=single');
        $_ENV['LOG_CHANNEL'] = 'single';
        $_SERVER['LOG_CHANNEL'] = 'single';
        config(['cache.default' => 'array', 'logging.default' => 'single']);

        Storage::fake('public');

        $product = Product::factory()->create();

        // Create without firing model events: the `created` observer would
        // dispatch the job onto the redis queue (per the job's connection),
        // which needs a live Redis server. We invoke handle() manually below.
        $media = ProductMedia3D::withoutEvents(fn () => ProductMedia3D::forceCreate([
            'product_id' => $product->id,
            'original_file_url' => 'models/3d/missing.glb',
        ]));

        try {
            (new Optimize3DModelJob($media->id))->handle();
            $this->fail('Expected RuntimeException for missing source file.');
        } catch (\RuntimeException $e) {
            $this->assertMatchesRegularExpression('/not found/i', $e->getMessage());
        }
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
}
