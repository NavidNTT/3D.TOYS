<?php

/*
|--------------------------------------------------------------------------
| The MinIO object store
|--------------------------------------------------------------------------
|
| Canonical product/media storage: MinIO, spoken through the S3 protocol.
| AWS_ENDPOINT is the Docker-internal address used by the containers; AWS_URL is
| the published endpoint browsers receive, so generated URLs never carry a host
| the browser cannot resolve. Path-style addressing is required for a single
| MinIO endpoint.
|
| Declared once and exposed under both names the project uses:
|
|   s3     — the canonical disk (`MEDIA_CANONICAL_DISK`, `Storage::disk('s3')`)
|   minio  — the same bucket under the name operators reach for. The ingestion
|            disk is documented as `MEDIA_INGEST_DISK=minio`, so that value has
|            to resolve; two names, one definition, nothing can drift.
|
| The disk is deliberately built from environment values only — no credentials
| or bucket names live here.
*/
$minio = [
    'driver' => 's3',
    'key' => env('AWS_ACCESS_KEY_ID'),
    'secret' => env('AWS_SECRET_ACCESS_KEY'),
    'region' => env('AWS_DEFAULT_REGION'),
    'bucket' => env('AWS_BUCKET'),
    'url' => env('AWS_URL'),
    'endpoint' => env('AWS_ENDPOINT'),
    'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),

    // Fail loudly rather than silently writing nowhere. Canonical media has no
    // local fallback: a misconfigured MinIO must surface as an error, never as
    // a quiet switch to the public disk (see App\Support\MediaStorage).
    'throw' => true,
    'report' => false,
];

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // The MinIO bucket, defined above. `minio` is an alias of `s3` so the
        // documented `MEDIA_INGEST_DISK=minio` resolves instead of erroring.
        's3' => $minio,
        'minio' => $minio,

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
