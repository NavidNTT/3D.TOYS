<?php

namespace App\Jobs;

use App\Models\ProductMedia3D;
use App\Support\MediaStorage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Filesystem\Filesystem;
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
 *
 * ## Streaming instead of `->path()`
 *
 * The optimizer used to read and write through `$disk->path()`, which only the
 * local adapter implements — that single line was what kept uploads pinned to
 * the `public` disk. The CLI still needs real filesystem paths, so both halves
 * now stream through a private temporary directory instead:
 *
 *   1. pull the object down from the ingest disk (MinIO or local) into a temp
 *      file, so the input is a real path whatever the disk is,
 *   2. run `gltf-transform` from that temp file to a second temp file,
 *   3. push the result back up to the same disk and read its size back to prove
 *      what landed.
 *
 * The temp directory is removed in a `finally`, so a failed run cannot leak a
 * multi-megabyte model into `/tmp`, and it is created with `0700` because a
 * model is a product asset, not public scratch space.
 *
 * The recorded `optimized_file_url` is a bare object key
 * (`models/3d/optimized/x_opt.glb`), not a `/storage/…` path: that is what
 * `Media3DResource::publicUrl()` resolves through the canonical MinIO disk, and
 * it matches the keys the ingestion command writes.
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
        // CatalogSeeder) are real viewer URLs, not objects on a disk of ours.
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

        // Uploads land on the ingest disk, which is the canonical MinIO disk
        // (config/media.php); the temp-file streaming below is what makes an
        // object store a valid input/output for the Draco CLI.
        $diskName = MediaStorage::ingestDisk();
        $disk = Storage::disk($diskName);

        if (! $disk->exists($relativeInput)) {
            throw new RuntimeException(
                "Original 3D model file not found on [{$diskName}] disk: {$relativeInput}"
            );
        }

        $outputRelative = $this->buildOptimizedRelativePath($relativeInput);

        // Run: gltf-transform optimize "{input}" "{output}" --compress draco
        $binary = trim((string) config('models3d.binary', env('GLTF_TRANSFORM_PATH', 'gltf-transform')));
        if ($binary === '') {
            $binary = 'gltf-transform';
        }
        $timeout = (int) config('models3d.timeout', 120);

        $workDirectory = $this->makeWorkDirectory();

        // Declared before the try so the size read after it is never read
        // undefined; a throw skips both assignments and the write below.
        $originalSize = 0;
        $optimizedSize = 0;

        try {
            $extension = $this->extensionOf($relativeInput);
            $inputPath = $workDirectory.'/input.'.$extension;
            $outputPath = $workDirectory.'/output.'.$extension;

            $this->pullToLocalFile($disk, $relativeInput, $inputPath);

            // The size of what storage actually holds, not what the original
            // upload claimed: the reduction figure in the log has to be true.
            clearstatcache(true, $inputPath);
            $originalSize = (int) filesize($inputPath);

            // $binary may be a plain executable or a prefix with args
            // ('npx @gltf-transform/cli'), so use a shell command line.
            $commandLine = sprintf(
                '%s optimize %s %s --compress draco',
                $binary,
                escapeshellarg($inputPath),
                escapeshellarg($outputPath)
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

            if (! is_file($outputPath)) {
                throw new RuntimeException(
                    "gltf-transform success but output missing: {$outputPath}"
                );
            }

            clearstatcache(true, $outputPath);
            $optimizedSize = (int) filesize($outputPath);

            // A zero-byte result would be published as the model the viewer
            // streams in preference to the original, so it is never accepted.
            if ($optimizedSize <= 0) {
                throw new RuntimeException(
                    "gltf-transform produced an empty file for media #{$media->id}."
                );
            }

            $this->pushFromLocalFile($disk, $outputPath, $outputRelative);

            // Read the size back from the disk: an object that was written
            // partially (or not at all) must fail here, while the job can still
            // be retried, rather than becoming the URL the storefront serves.
            $storedSize = (int) $disk->size($outputRelative);

            if ($storedSize !== $optimizedSize) {
                throw new RuntimeException(sprintf(
                    'Optimized upload size mismatch for %s on [%s]: local %d, stored %d.',
                    $outputRelative,
                    $diskName,
                    $optimizedSize,
                    $storedSize,
                ));
            }
        } finally {
            $this->removeDirectory($workDirectory);
        }

        // Only touch result columns so the `updated` observer does not loop.
        $media->forceFill([
            'optimized_file_url' => $outputRelative,
            'file_size' => $optimizedSize,
        ])->saveQuietly();

        $reduction = $originalSize > 0
            ? round((($originalSize - $optimizedSize) / $originalSize) * 100, 2)
            : 0.0;

        Log::info('[Optimize3DModelJob] 3D model optimized (Draco).', [
            'id' => $media->id,
            'product_id' => $media->product_id,
            'disk' => $diskName,
            'input' => $relativeInput,
            'output' => $outputRelative,
            'original_bytes' => $originalSize,
            'optimized_bytes' => $optimizedSize,
            'reduction_percent' => $reduction,
        ]);
    }

    /**
     * A private scratch directory for one run.
     *
     * `0700` and a random suffix: the directory holds a model the store has not
     * published yet, and two workers optimizing at once must not share paths.
     *
     * @return string Absolute path of the created directory.
     */
    protected function makeWorkDirectory(): string
    {
        $directory = rtrim(sys_get_temp_dir(), '/\\')
            .'/3toys-optimize-'.$this->productMedia3DId.'-'.bin2hex(random_bytes(6));

        if (! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            throw new RuntimeException("Cannot create the optimization workspace: {$directory}");
        }

        return $directory;
    }

    /**
     * Copy an object from any disk to a local path.
     *
     * Streamed rather than read into memory: the largest fixture in this store
     * is 22 MB and buffering it would put a hard ceiling on model size.
     */
    protected function pullToLocalFile(Filesystem $disk, string $key, string $destination): void
    {
        $source = $disk->readStream($key);

        if (! is_resource($source)) {
            throw new RuntimeException("Cannot read the stored object: {$key}");
        }

        $target = fopen($destination, 'wb');

        if ($target === false) {
            fclose($source);

            throw new RuntimeException("Cannot open the workspace file for writing: {$destination}");
        }

        try {
            if (stream_copy_to_stream($source, $target) === false) {
                throw new RuntimeException("Failed while copying {$key} out of storage.");
            }
        } finally {
            fclose($source);
            fclose($target);
        }
    }

    /**
     * Copy a local file up to any disk, creating the parent key first.
     */
    protected function pushFromLocalFile(Filesystem $disk, string $source, string $key): void
    {
        // A no-op on object storage, where keys are flat; required on a local
        // disk, where `models/3d/optimized/…` has to exist before it is written.
        $disk->makeDirectory(dirname($key));

        $stream = fopen($source, 'rb');

        if ($stream === false) {
            throw new RuntimeException("Cannot open the optimized file for reading: {$source}");
        }

        try {
            $disk->writeStream($key, $stream);
        } finally {
            fclose($stream);
        }
    }

    /**
     * Delete the run's scratch directory and everything in it.
     *
     * Called from a `finally`, so a thrown optimization failure still cleans up.
     */
    protected function removeDirectory(string $directory): void
    {
        if (! is_dir($directory)) {
            return;
        }

        foreach (glob($directory.'/*') ?: [] as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }

        rmdir($directory);
    }

    /**
     * Normalize a stored URL/path to a disk-relative object key.
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
        $extension = $this->extensionOf($relativeInput);

        $slug = preg_replace('/[^A-Za-z0-9._-]+/', '_', (string) $basename);
        $slug = trim((string) $slug, '_.') ?: 'model';

        return $outputDir.'/'.$slug.'_opt.'.$extension;
    }

    /**
     * Lower-case extension of a key, defaulting to `glb`.
     */
    protected function extensionOf(string $key): string
    {
        $extension = strtolower(pathinfo($key, PATHINFO_EXTENSION));

        return $extension !== '' ? $extension : 'glb';
    }
}
