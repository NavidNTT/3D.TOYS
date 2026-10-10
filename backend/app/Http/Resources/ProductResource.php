<?php

namespace App\Http\Resources;

use App\Models\Product;
use App\Support\Currency;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A catalog item as the storefront consumes it.
 *
 * Two conventions worth keeping:
 *
 *  - Money is integer Toman (one Toman is the smallest unit) and counters are
 *    integers. Eloquent returns the amount as a PHP int **only when the row's
 *    currency really is IRT** (see the `Product` accessors), so the JSON
 *    carries real numbers with no decimal point anywhere.
 *  - `category` and `media_3d` are always present, `null` when absent, rather
 *    than omitted. The storefront's types are nullable, so an explicit null
 *    keeps the shape stable no matter which relations were eager-loaded.
 *
 * Temporary compatibility shape (documented on purpose):
 *
 *  - `price` is `int|null`. Null is not "free" — it means this row has no
 *    chargeable toman amount (a legacy `12.99 USD` row, or a non-integral
 *    value). The alternative, `(int) 12.99`, would ship `12` and let the
 *    storefront call it twelve toman, which is the bug this contract removes.
 *  - `purchasable` is the server's single answer to "may this be added to a
 *    cart?". The storefront keys its add-to-cart and checkout gates off it so
 *    the UI and the checkout service can never disagree.
 *  - `legacy_price` / `legacy_compare_at_price` / `legacy_currency` carry the
 *    preserved, verbatim original amount for rows that are **not**
 *    purchasable. They are null for clean IRT rows. They exist so the legacy
 *    currency is displayed honestly instead of being relabelled as toman, and
 *    so an operator can see exactly what is waiting for an approved mapping.
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
        $currency = Currency::normalize($this->currency);

        // Integer toman, or null when the row has no chargeable toman amount.
        // The accessor never rounds, so a legacy `12.99` reaches here as null.
        $price = $this->price;
        $compareAtPrice = $this->compare_at_price;

        $purchasable = $price !== null && Currency::isSellable($currency);

        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,

            'price' => $price,
            'compare_at_price' => $compareAtPrice,
            'currency' => $currency,
            'purchasable' => $purchasable,

            'legacy_price' => $purchasable ? null : $this->legacyAmount('price'),
            'legacy_compare_at_price' => $purchasable ? null : $this->legacyAmount('compare_at_price'),
            'legacy_currency' => $purchasable ? null : Currency::normalize($this->legacyCurrency()),

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
