<?php

namespace App\Observers;

use App\Jobs\Optimize3DModelJob;
use App\Models\ProductMedia3D;

class ProductMedia3DObserver
{
    /**
     * Dispatch Draco optimization when a 3D record is created with a file.
     *
     * Remote URLs (http(s)://…) are viewer fixtures, not files on the public
     * disk — the job can only fail on them, so they are never dispatched.
     * Real uploads store a disk-relative path (models/3d/…) or a
     * /storage/… URL, and only those go through the Draco pipeline.
     */
    public function created(ProductMedia3D $media): void
    {
        if (! empty($media->original_file_url) && ! str_contains((string) $media->original_file_url, '://')) {
            Optimize3DModelJob::dispatch($media->id);
        }
    }

    /**
     * Re-optimize when the source file changes (same remote-URL guard).
     */
    public function updated(ProductMedia3D $media): void
    {
        if ($media->wasChanged('original_file_url')
            && ! empty($media->original_file_url)
            && ! str_contains((string) $media->original_file_url, '://')) {
            Optimize3DModelJob::dispatch($media->id);
        }
    }
}
