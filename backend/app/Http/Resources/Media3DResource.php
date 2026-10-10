<?php

namespace App\Http\Resources;

use App\Models\ProductMedia3D;
use App\Support\MediaStorage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * The 3D asset plus viewer settings attached to a product.
 *
 * The API contract is deliberately flatter than the `media3d` table: consumers
 * get one absolute `url` and a `format` derived from the file extension, so the
 * storefront never has to know that an upload lands in `original_file_url`
 * while the Draco optimizer writes `optimized_file_url` next to it.
 *
 * @mixin ProductMedia3D
 */
class Media3DResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $url = static::urlFor($this->resource);

        return [
            'id' => $this->id,

            // Prefer the Draco-compressed file: same geometry, a fraction of
            // the bytes, which is what a mobile storefront wants. The
            // uncompressed original is the fallback while the queued
            // Optimize3DModelJob has not finished yet.
            'url' => $url,
            'format' => static::formatOf($url),

            // The table has no alt-text column yet; the lightbox card falls
            // back to the product name (see ProductCard.tsx).
            'alt_text' => null,

            'thumbnail_url' => static::publicUrl($this->thumbnail_url),
            'file_size' => $this->file_size === null ? null : (int) $this->file_size,
            'lighting_preset' => $this->lighting_preset,
            'camera_settings' => $this->camera_settings,
        ];
    }

    /**
     * The viewer URL for a media row, or null when no file has been stored.
     *
     * Optimized beats original, and "nothing at all" is a real state: the admin
     * can save viewer settings before (or without) uploading a model.
     */
    public static function urlFor(?ProductMedia3D $media): ?string
    {
        if (! $media instanceof ProductMedia3D) {
            return null;
        }

        return static::publicUrl($media->optimized_file_url)
            ?? static::publicUrl($media->original_file_url);
    }

    /**
     * Turn whatever sits in a URL column into something a browser can fetch.
     *
     * Three shapes reach this method, because three different writers create
     * them: a full URL (external CDN, or a MinIO endpoint written by an
     * importer), the public-disk path the optimizer stores
     * (`/storage/models/3d/optimized/x_opt.glb`), and a bare relative path
     * (`models/3d/x.glb`) as handed to Storage.
     */
    public static function publicUrl(?string $path): ?string
    {
        if ($path === null || trim($path) === '') {
            return null;
        }

        $path = trim($path);

        // Already absolute — hand it back untouched.
        if (preg_match('#^https?://#i', $path) === 1) {
            return $path;
        }

        $relative = ltrim($path, '/');

        // The optimizer stores the public-facing path, which already contains
        // the `/storage` prefix that the disk helper adds on its own.
        $isLegacyLocalPath = str_starts_with($relative, 'storage/');

        if ($isLegacyLocalPath) {
            $relative = substr($relative, strlen('storage/'));
        }

        // The `public` disk is the one the 3D pipeline reads and writes (see
        // Optimize3DModelJob) and `public/storage` is symlinked to it, so
        // APP_URL + /storage/... is reachable from the browser. Serving 3D
        // media through MinIO instead is exactly what the canonical branch
        // below does: a bare object key resolves against the MinIO disk, while
        // the legacy `/storage/...` shape keeps resolving against the local
        // public disk the optimizer still writes to.
        return $isLegacyLocalPath
            ? Storage::disk('public')->url($relative)
            : MediaStorage::canonicalUrl($relative);
    }

    /**
     * `glb` / `gltf` for the viewer, derived from the served file name.
     */
    private static function formatOf(?string $url): string
    {
        if ($url === null) {
            return 'glb';
        }

        $path = parse_url($url, PHP_URL_PATH);
        $extension = strtolower(pathinfo(is_string($path) ? $path : $url, PATHINFO_EXTENSION));

        return $extension !== '' ? $extension : 'glb';
    }
}
