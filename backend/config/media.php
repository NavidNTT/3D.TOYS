<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Canonical media disk
    |--------------------------------------------------------------------------
    |
    | The one place product media belongs. It is an S3-compatible disk talking
    | to MinIO (see config/filesystems.php → disks.s3), reached through the
    | Docker-internal endpoint while the URL handed to browsers comes from
    | AWS_URL. Both are environment-driven; no credentials live here.
    |
    | The name is a config value rather than a literal so the rest of the code
    | never spells 's3' itself: swapping the object store later is an env
    | change, not a search-and-replace.
    |
    */

    'canonical_disk' => env('MEDIA_CANONICAL_DISK', 's3'),

    /*
    |--------------------------------------------------------------------------
    | Ingestion disk (where uploads are written)
    |--------------------------------------------------------------------------
    |
    | The canonical disk: MinIO. Uploads from the admin panel are written
    | straight to object storage and the Draco optimizer streams them down into
    | a private temp directory, runs `gltf-transform`, and pushes the result
    | back — no local `->path()` anywhere (App\Jobs\Optimize3DModelJob).
    |
    | Kept as its own knob rather than hard-wired to `canonical_disk` so an
    | operator can still send ingestion elsewhere; it defaults to the canonical
    | disk, so reads and writes name the same bucket unless someone says
    | otherwise.
    |
    */

    'ingest_disk' => env('MEDIA_INGEST_DISK', env('MEDIA_CANONICAL_DISK', 's3')),

];
