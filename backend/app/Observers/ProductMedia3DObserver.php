<?php

namespace App\Observers;

use App\Jobs\Optimize3DModelJob;
use App\Models\ProductMedia3D;

class ProductMedia3DObserver
{
    /**
     * Dispatch Draco optimization when a 3D record is created with a file.
     */
    public function created(ProductMedia3D $media): void
    {
        if (! empty($media->original_file_url)) {
            Optimize3DModelJob::dispatch($media->id);
        }
    }

    /**
     * Re-optimize when the source file changes.
     */
    public function updated(ProductMedia3D $media): void
    {
        if ($media->wasChanged('original_file_url') && ! empty($media->original_file_url)) {
            Optimize3DModelJob::dispatch($media->id);
        }
    }
}
