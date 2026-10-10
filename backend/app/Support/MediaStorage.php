<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

/**
 * Where product media lives.
 *
 * One source of truth for the two answers the codebase keeps needing:
 *
 *  - **Which disk serves media?** — {@see self::canonicalDisk()}: the
 *    S3-compatible MinIO disk. URL resolution goes through it so a stored
 *    object key becomes a browser-reachable URL.
 *  - **Which disk receives uploads?** — {@see self::ingestDisk()}: the same
 *    canonical disk. It is a separate knob only so an operator can point
 *    ingestion somewhere else; by default the two agree, because the Draco
 *    optimizer streams through local temp files rather than relying on the
 *    local adapter's `->path()`.
 *
 * Nothing here falls back to a local disk for canonical media: if the MinIO
 * disk is misconfigured the S3 adapter raises (the disk is declared with
 * `throw => true`), instead of quietly serving from `public` and hiding the
 * breakage.
 */
final class MediaStorage
{
    private function __construct() {}

    /**
     * The disk that holds canonical product/media objects (MinIO over S3).
     */
    public static function canonicalDisk(): string
    {
        /** @var string $disk */
        $disk = config('media.canonical_disk', 's3');

        return $disk;
    }

    /**
     * The disk new uploads are written to.
     *
     * Defaults to the canonical disk (MinIO). config/media.php still exposes an
     * override for an operator who wants ingestion elsewhere, but nothing in
     * the pipeline depends on a local filesystem any more — see
     * App\Jobs\Optimize3DModelJob, which streams through temp files.
     */
    public static function ingestDisk(): string
    {
        /** @var string|null $disk */
        $disk = config('media.ingest_disk');

        return is_string($disk) && $disk !== '' ? $disk : self::canonicalDisk();
    }

    /**
     * The canonical disk instance.
     */
    public static function canonical(): Filesystem
    {
        return Storage::disk(self::canonicalDisk());
    }

    /**
     * Browser-reachable URL for an object key on the canonical disk.
     *
     * The disk's `url` comes from `AWS_URL` (the published MinIO endpoint), not
     * `AWS_ENDPOINT` (the Docker-internal one), so the result never carries a
     * hostname the browser cannot resolve.
     */
    public static function canonicalUrl(string $key): string
    {
        return self::canonical()->url(ltrim($key, '/'));
    }
}
