<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A catalog item as the storefront consumes it.
 *
 * Two conventions worth keeping:
 *
 *  - Money is integer Toman (one Toman is the smallest unit) and counters are
 *    integers. Eloquent returns them as PHP ints via the model casts, so the
 *    JSON carries real numbers with no decimal point anywhere.
 *  - `category` and `media_3d` are always present, `null` when absent, rather
 *    than omitted. The storefront's types are nullable, so an explicit null
 *    keeps the shape stable no matter which relations were eager-loaded.
 *
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,

            'price' => (int) $this->price,
            'compare_at_price' => $this->compare_at_price === null
                ? null
                : (int) $this->compare_at_price,
            'currency' => $this->currency,

            'stock' => (int) $this->stock,
            'is_active' => (bool) $this->is_active,

            'attributes' => $this->attributes,

            'category' => $this->categoryPayload(),
            'media_3d' => $this->media3dPayload(),

            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * The category, only reading the relation the caller eager-loaded.
     *
     * @return array<string, mixed>|null
     */
    private function categoryPayload(): ?array
    {
        $product = $this->resource;

        if (! $product instanceof Product
            || ! $product->relationLoaded('category')
            || $product->category === null) {
            return null;
        }

        return CategoryResource::make($product->category)->resolve();
    }

    /**
     * The 3D asset, or null when the product has none to show.
     *
     * A media row without any stored file is treated as "no model": the
     * storefront would otherwise mount a WebGL viewer that has nothing to load
     * and render a broken canvas instead of its placeholder panel.
     *
     * @return array<string, mixed>|null
     */
    private function media3dPayload(): ?array
    {
        $product = $this->resource;

        if (! $product instanceof Product
            || ! $product->relationLoaded('media3d')
            || $product->media3d === null
            || Media3DResource::urlFor($product->media3d) === null) {
            return null;
        }

        return Media3DResource::make($product->media3d)->resolve();
    }
}
