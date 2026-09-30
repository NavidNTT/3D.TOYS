<?php

namespace App\Services\Catalog;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Collection;

/**
 * Read model for the storefront catalog.
 *
 * Deliberately read-only. Writes belong to the Filament admin panel and the
 * Draco pipeline, so the public API cannot drift from the admin's validation
 * rules and there is exactly one place where a product is published.
 *
 * Each query eager-loads precisely the two relations {@see \App\Http\Resources\ProductResource}
 * serialises — `category` for theming and `media3d` for the viewer — so a
 * listing stays at three queries (products, categories, media) regardless of
 * how many rows it returns, instead of the N+1 the storefront hit before.
 */
class CatalogService
{
    /**
     * Every category, ordered the way the storefront's navigation renders it.
     *
     * @return Collection<int, Category>
     */
    public function categories(): Collection
    {
        return Category::query()
            ->orderBy('name')
            ->get();
    }

    /**
     * The published catalog, newest first.
     *
     * `is_active` is the storefront's only visibility rule: a draft or archived
     * product must not be purchasable, and an unpublished product must not even
     * be listed (it would 404 on its detail page otherwise).
     *
     * @return Collection<int, Product>
     */
    public function publishedProducts(): Collection
    {
        return Product::query()
            ->where('is_active', true)
            ->with(['category', 'media3d'])
            ->orderByDesc('id')
            ->get();
    }

    /**
     * One published product by slug, or null when it does not exist.
     *
     * Returning null instead of throwing keeps the "not published" and "does
     * not exist" cases identical to the caller, which is what the storefront
     * needs: both must become a 404 page, not an error page.
     */
    public function publishedProductBySlug(string $slug): ?Product
    {
        return Product::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->with(['category', 'media3d'])
            ->first();
    }
}
