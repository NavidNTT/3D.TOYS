<?php

namespace App\Jobs;

use App\Models\ProductMedia3D;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * Compress an uploaded 3D model (.glb / .gltf) with Google Draco via
 * the `@gltf-transform/cli` tool:
 *
 *   gltf-transform optimize {input} {output} --compress draco
 *
 * The CLI binary is configurable via `.env`:
 *   GLTF_TRANSFORM_PATH="gltf-transform"  (global install)
 *   GLTF_TRANSFORM_PATH="npx @gltf-transform/cli"  (local npx usage)
 */
class Optimize3DModelJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Maximum seconds the Draco process may run. */
    public $timeout = 120;

    /** Attempts: initial try + 1 retry (matches "Retries: 2"). */
    public $tries = 2;

    /** @param int $productMedia3DId Primary key on the `media3d` table. */
    public function __construct(public int $productMedia3DId)
    {
        // NOTE: $connection/$queue are declared by the Queueable trait, so
        // they cannot be redeclared here (PHP treats a different default as
        // incompatible). Assign the inherited properties instead — this is
        // what `onConnection()`/`onQueue()` do internally.
        $this->connection = 'redis';
        $this->queue = 'default';
    }

    public function handle(): void
    {
        $media = ProductMedia3D::find($this->productMedia3DId);

        if (! $media) {
            Log::warning('[Optimize3DModelJob] ProductMedia3D record not found.', [
                'id' => $this->productMedia3DId,
            ]);

            return;
        }

        if (empty($media->original_file_url)) {
            Log::warning('[Optimize3DModelJob] No original_file_url set; skipping.', [
                'id' => $media->id,
            ]);

            return;
        }

        // Remote demo fixtures (e.g. the Khronos Duck.glb seeded by
        // CatalogSeeder) are real viewer URLs, not files on the public disk.
        // They arrive here when a model event fires outside the seeder's
        // withoutEvents() guard, or from an older queued job that predates the
        // guard. Re-downloading arbitrary URLs on the worker is out of scope,
        // so skip quietly instead of throwing — a throw would retry, then land
        // in failed_jobs on every fresh install and make the worker look
        // broken.
        if (str_contains((string) $media->original_file_url, '://')) {
            Log::info('[Optimize3DModelJob] Remote model URL; skipping Draco optimization.', [
                'id' => $media->id,
            ]);

            return;
        }

        $relativeInput = $this->normalizeRelativePath($media->original_file_url);
        $disk = Storage::disk('public');

        if (! $disk->exists($relativeInput)) {
            throw new RuntimeException(
                "Original 3D model file not found on [public] disk: {$relativeInput}"
            );
        }

        $inputAbsolutePath = $disk->path($relativeInput);
        $originalSize = (int) $disk->size($relativeInput);

        // Optimized filename (`*_opt.glb`) under models/3d/optimized/.
        $outputRelative = $this->buildOptimizedRelativePath($relativeInput);
        $disk->makeDirectory(dirname($outputRelative));
        $outputAbsolutePath = $disk->path($outputRelative);

        // Run: gltf-transform optimize "{input}" "{output}" --compress draco
        $binary = trim((string) config('models3d.binary', env('GLTF_TRANSFORM_PATH', 'gltf-transform')));
        if ($binary === '') {
            $binary = 'gltf-transform';
        }
        $timeout = (int) config('models3d.timeout', 120);

        // $binary may be a plain executable or a prefix with args
        // ('npx @gltf-transform/cli'), so use a shell command line.
        $commandLine = sprintf(
            '%s optimize %s %s --compress draco',
            $binary,
            escapeshellarg($inputAbsolutePath),
            escapeshellarg($outputAbsolutePath)
        );

        $process = Process::fromShellCommandline($commandLine);
        $process->setTimeout($timeout > 0 ? $timeout : 120);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException(sprintf(
                'gltf-transform failed for media #%d. Error: %s',
                $media->id,
                trim($process->getErrorOutput().' '.$process->getOutput())
            ));
        }

        if (! is_file($outputAbsolutePath)) {
            throw new RuntimeException(
                "gltf-transform success but output missing: {$outputAbsolutePath}"
            );
        }

        clearstatcache(true, $outputAbsolutePath);
        $optimizedSize = (int) filesize($outputAbsolutePath);
        $optimizedUrl = '/storage/'.ltrim($outputRelative, '/');

        // Only touch result columns so the `updated` observer does not loop.
        $media->forceFill([
            'optimized_file_url' => $optimizedUrl,
            'file_size' => $optimizedSize,
        ])->saveQuietly();

        $reduction = $originalSize > 0
            ? round((($originalSize - $optimizedSize) / $originalSize) * 100, 2)
            : 0.0;

        Log::info('[Optimize3DModelJob] 3D model optimized (Draco).', [
            'id' => $media->id,
            'product_id' => $media->product_id,
            'input' => $relativeInput,
            'output' => $outputRelative,
            'original_bytes' => $originalSize,
            'optimized_bytes' => $optimizedSize,
            'reduction_percent' => $reduction,
        ]);
    }

    /**
     * Normalize a stored URL/path to a `public`-disk relative path.
     * Accepts `models/3d/foo.glb`, `/storage/models/3d/foo.glb`,
     * or a full URL containing `/storage/...`.
     */
    protected function normalizeRelativePath(string $url): string
    {
        $path = trim($url);

        if (str_contains($path, '://')) {
            $parsed = parse_url($path, PHP_URL_PATH);
            $path = is_string($parsed) ? $parsed : $path;
        }

        $path = ltrim($path, '/');

        if (str_starts_with($path, 'storage/')) {
            $path = substr($path, strlen('storage/'));
        }

        return $path;
    }

    /**
     * Build `models/3d/optimized/{basename}_opt.{ext}` for any input.
     */
    protected function buildOptimizedRelativePath(string $relativeInput): string
    {
        $outputDir = trim((string) config('models3d.output_directory', 'models/3d/optimized'), '/');
        if ($outputDir === '') {
            $outputDir = 'models/3d/optimized';
        }

        $basename = pathinfo($relativeInput, PATHINFO_FILENAME);
        $extension = pathinfo($relativeInput, PATHINFO_EXTENSION);
        $extension = $extension !== '' ? strtolower($extension) : 'glb';

        $slug = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) $basename);
        $slug = trim((string) $slug, '_.') ?: 'model';

        return $outputDir.'/'.$slug.'_opt.'.$extension;
    }
}
