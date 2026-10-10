<?php

namespace Tests\Feature\Storage;

use App\Http\Resources\Media3DResource;
use App\Support\MediaStorage;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\AwsS3V3\AwsS3V3Adapter;
use Tests\TestCase;

/**
 * Guards the MinIO/S3 storage foundation.
 *
 * These are configuration and URL-resolution assertions: they never talk to
 * MinIO, so they run on every engine and in CI without a bucket. What they
 * protect is the pair of rules the storefront depends on —
 *
 *   1. canonical media lives on an S3-compatible disk that fails loudly
 *      instead of silently falling back to local storage, and
 *   2. the URL handed to the browser is the *public* endpoint, never the
 *      Docker-internal `minio:9000` hostname the browser cannot resolve.
 */
class MediaStorageTest extends TestCase
{
    public function test_the_canonical_media_disk_is_a_path_style_s3_disk(): void
    {
        $name = MediaStorage::canonicalDisk();

        $this->assertSame('s3', $name);

        $disk = config("filesystems.disks.{$name}");

        $this->assertSame('s3', $disk['driver']);
        $this->assertTrue(
            (bool) $disk['use_path_style_endpoint'],
            'A single MinIO endpoint requires path-style addressing.',
        );
        $this->assertNotEmpty($disk['endpoint'], 'AWS_ENDPOINT (internal MinIO) must be configured.');
        $this->assertNotEmpty($disk['bucket'], 'AWS_BUCKET must be configured.');
        $this->assertNotEmpty($disk['url'], 'AWS_URL (browser-facing MinIO) must be configured.');
    }

    public function test_canonical_media_never_falls_back_to_a_local_disk(): void
    {
        $disk = config('filesystems.disks.'.MediaStorage::canonicalDisk());

        $this->assertTrue(
            $disk['throw'],
            'The canonical disk must raise on failure; a silent local fallback would hide a broken MinIO.',
        );
    }

    public function test_the_s3_adapter_is_installed_and_the_disk_resolves(): void
    {
        $this->assertTrue(
            class_exists(AwsS3V3Adapter::class),
            'league/flysystem-aws-s3-v3 is required — the s3 disk is unusable without it.',
        );
        $this->assertInstanceOf(Filesystem::class, MediaStorage::canonical());
    }

    public function test_the_browser_facing_url_is_not_the_internal_endpoint(): void
    {
        $disk = config('filesystems.disks.'.MediaStorage::canonicalDisk());

        $endpointHost = parse_url((string) $disk['endpoint'], PHP_URL_HOST);
        $urlHost = parse_url((string) $disk['url'], PHP_URL_HOST);

        $this->assertNotSame(
            $endpointHost,
            $urlHost,
            'AWS_URL must be host-reachable; AWS_ENDPOINT is the Docker-internal address.',
        );
    }

    public function test_a_relative_object_key_resolves_through_the_canonical_disk(): void
    {
        $url = Media3DResource::publicUrl('models/3d/robot.glb');

        $this->assertNotNull($url);
        $this->assertStringStartsWith('http', $url);
        $this->assertStringContainsString('models/3d/robot.glb', $url);
        $this->assertStringNotContainsString(
            'minio:9000',
            $url,
            'The internal Docker hostname must never leak into browser-facing JSON.',
        );
    }

    public function test_legacy_public_disk_paths_still_resolve(): void
    {
        $url = Media3DResource::publicUrl('/storage/models/3d/legacy.glb');

        $this->assertNotNull($url);
        $this->assertStringContainsString('models/3d/legacy.glb', $url);
        $this->assertStringNotContainsString('minio:9000', $url);
    }

    public function test_absolute_urls_are_preserved_verbatim(): void
    {
        $external = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb';

        $this->assertSame($external, Media3DResource::publicUrl($external));
        $this->assertNull(Media3DResource::publicUrl(null));
        $this->assertNull(Media3DResource::publicUrl('   '));
    }

    public function test_uploads_go_to_the_same_canonical_minio_disk_as_reads(): void
    {
        // The Draco optimizer streams through temp files, so ingestion no
        // longer needs a local path: one disk both serves and receives media.
        $this->assertSame('s3', MediaStorage::canonicalDisk());
        $this->assertSame(MediaStorage::canonicalDisk(), MediaStorage::ingestDisk());
    }

    public function test_the_ingest_disk_falls_back_to_the_canonical_disk(): void
    {
        // An operator may point ingestion somewhere else, but leaving the knob
        // unset must never silently mean "the local public disk" again.
        config(['media.ingest_disk' => null]);

        $this->assertSame(MediaStorage::canonicalDisk(), MediaStorage::ingestDisk());

        config(['media.ingest_disk' => '']);

        $this->assertSame(MediaStorage::canonicalDisk(), MediaStorage::ingestDisk());
    }

    public function test_the_minio_alias_is_the_same_disk_as_the_canonical_one(): void
    {
        // Ingestion is documented as `MEDIA_INGEST_DISK=minio`, so that name has
        // to resolve — and to the same bucket, not a second definition that
        // could drift away from the canonical disk.
        $canonical = config('filesystems.disks.'.MediaStorage::canonicalDisk());
        $alias = config('filesystems.disks.minio');

        $this->assertIsArray($alias);
        $this->assertSame($canonical, $alias);
        $this->assertInstanceOf(Filesystem::class, Storage::disk('minio'));
    }

    public function test_the_optimizer_never_relies_on_a_local_path(): void
    {
        // `path()` exists only on local adapters, and one call to it is exactly
        // what pinned uploads to the `public` disk. Guard the streaming shape
        // so a future edit cannot quietly reintroduce the dependency.
        //
        // Comments are stripped first: the job's docblock names the old call on
        // purpose, so a plain substring check would fail on its own prose.
        $code = '';

        foreach (token_get_all((string) file_get_contents(app_path('Jobs/Optimize3DModelJob.php'))) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            $code .= is_array($token) ? $token[1] : $token;
        }

        $this->assertStringNotContainsString('->path(', $code);
        $this->assertStringContainsString('readStream(', $code);
        $this->assertStringContainsString('writeStream(', $code);
    }
}
