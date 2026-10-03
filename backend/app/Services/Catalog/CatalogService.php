<?php

namespace App\Services\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Support\PersianText;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
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
    /** Page size the storefront uses when it does not ask for one. */
    public const DEFAULT_PER_PAGE = 24;

    /**
     * Hard ceiling for `?per_page=`.
     *
     * A storefront slice of the grid needs some room to move, but an unbounded
     * `per_page` would let one request pull the whole catalog (and its 3D media
     * rows) into memory on the API and the Next.js render.
     */
    public const MAX_PER_PAGE = 60;

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
     * The published catalog, newest first — searched, filtered and paginated.
     *
     * `is_active` is the storefront's only visibility rule: a draft or archived
     * product must not be purchasable, and an unpublished product must not even
     * be listed (it would 404 on its detail page otherwise).
     *
     * Supported filters:
     *   - `search`   : case-insensitive LIKE across `title` and `slug`
     *   - `category` : category *slug* (the storefront's route segment)
     *   - `in_stock` : only rows with stock left
     *
     * `attributes` is deliberately not searched: it is a JSON column, and a
     * portable LIKE across its text form is not "trivial" — MySQL and SQLite
     * coerce JSON to text differently, and `whereJsonContains` only matches
     * exactly. Structured attribute filtering is the honest next step if needed.
     *
     * The LIKE pattern carries a leading wildcard, so no index can serve it.
     * That is acceptable at this catalogue size; full-text search is the next
     * step, not an index hint placed here to look busy.
     *
     * @param  array{search?: string|null, category?: string|null, in_stock?: bool|string|null}  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function paginatedProducts(array $filters = [], int $perPage = self::DEFAULT_PER_PAGE): LengthAwarePaginator
    {
        $perPage = max(1, min($perPage, self::MAX_PER_PAGE));
        $search = PersianText::normalize($filters['search'] ?? null);
        $category = trim((string) ($filters['category'] ?? ''));
        $inStock = filter_var($filters['in_stock'] ?? false, FILTER_VALIDATE_BOOLEAN);

        return Product::query()
            ->where('is_active', true)
            ->when($search !== '', fn (Builder $query): Builder => $query->where(
                fn (Builder $inner): Builder => $inner
                    ->where('title', 'like', '%'.$search.'%')
                    ->orWhere('slug', 'like', '%'.$search.'%'),
            ))
            ->when($category !== '', fn (Builder $query): Builder => $query->whereHas(
                'category',
                fn (Builder $categoryQuery): Builder => $categoryQuery->where('slug', $category),
            ))
            ->when($inStock, fn (Builder $query): Builder => $query->where('stock', '>', 0))
            ->with(['category', 'media3d'])
            ->orderByDesc('id')
            ->paginate($perPage);
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
