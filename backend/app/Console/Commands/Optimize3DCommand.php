<?php

namespace App\Console\Commands;

use App\Jobs\Optimize3DModelJob;
use App\Models\ProductMedia3D;
use Illuminate\Console\Command;

class Optimize3DCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'toys:optimize-3d
                            {--id= : Optimize a single ProductMedia3D record by ID}
                            {--all : Optimize all un-optimized 3D models}';

    /**
     * @var string
     */
    protected $description = 'Dispatch Draco 3D-model optimization job(s) for a product or all un-optimized models';

    public function handle(): int
    {
        $id = $this->option('id');

        if ($id) {
            $media = ProductMedia3D::find($id);

            if (! $media) {
                $this->error("ProductMedia3D #{$id} not found.");

                return self::FAILURE;
            }

            Optimize3DModelJob::dispatch($media->id);
            $this->info("Dispatched Optimize3DModelJob for ProductMedia3D #{$media->id}.");

            return self::SUCCESS;
        }

        $query = ProductMedia3D::query()->whereNotNull('original_file_url');

        if ($this->option('all')) {
            // Re-process everything with a source file (useful after CLI upgrades).
            $count = 0;
            $query->orderBy('id')->chunkById(100, function ($items) use (&$count) {
                foreach ($items as $media) {
                    Optimize3DModelJob::dispatch($media->id);
                    $count++;
                }
            });

            $this->info("Dispatched {$count} optimization job(s) (--all).");

            return self::SUCCESS;
        }

        // Default: only models that have never been optimized.
        $count = 0;
        $query->whereNull('optimized_file_url')->orderBy('id')->chunkById(100, function ($items) use (&$count) {
            foreach ($items as $media) {
                Optimize3DModelJob::dispatch($media->id);
                $count++;
            }
        });

        if ($count === 0) {
            $this->info('Nothing to optimize: every 3D model already has an optimized file. Use --all to force reprocessing.');

            return self::SUCCESS;
        }

        $this->info("Dispatched {$count} optimization job(s).");

        return self::SUCCESS;
    }
}
