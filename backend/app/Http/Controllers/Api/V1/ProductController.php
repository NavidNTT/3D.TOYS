<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\ProductIndexRequest;
use App\Http\Resources\ProductResource;
use App\Services\Catalog\CatalogService;
use App\Support\ApiResponse;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Public catalog reads for the storefront.
 *
 * Thin on purpose: the controller resolves the query through the service and
 * lets the exception handler in bootstrap/app.php shape the error envelope, so
 * a missing product answers with the same JSON shape as every other 404.
 */
class ProductController extends Controller
{
    public function __construct(
        private readonly CatalogService $catalogService,
    ) {}

    /**
     * GET /api/v1/products?search=&category=&in_stock=&page=&per_page=
     *
     * Only published products are listed; each one carries its category (for
     * theming) and its 3D asset (for the viewer).
     *
     * The pagination metadata is assembled here explicitly rather than handing
     * the paginator to the resource collection: `ApiResponse` wraps everything
     * in the shared `{success, message, data}` envelope, and a resource nested
     * one level down is serialised through `JsonSerializable`, which emits the
     * rows only — the framework's `links`/`meta` are added by the response
     * pipeline that the envelope deliberately bypasses. Building it here keeps
     * the contract explicit (and matches the frontend's `Paginated<T>` type):
     *
     *   data: { data: [...rows], meta: {...}, links: {...} }
     */
    public function index(ProductIndexRequest $request): JsonResponse
    {
        $products = $this->catalogService->paginatedProducts(
            // `safe()` keeps unknown keys out of the query builder.
            $request->safe()->only(['search', 'category', 'in_stock']),
            (int) ($request->validated('per_page') ?? CatalogService::DEFAULT_PER_PAGE),
        );

        return ApiResponse::success(
            $this->paginatedPayload($products, $request),
            'فهرست محصولات با موفقیت دریافت شد.',
        );
    }

    /**
     * The rows plus the paging metadata the storefront renders its grid with.
     *
     * @return array<string, mixed>
     */
    private function paginatedPayload(LengthAwarePaginator $products, Request $request): array
    {
        return [
            'data' => ProductResource::collection($products->items())->resolve($request),
            'meta' => [
                'current_page' => $products->currentPage(),
                'per_page' => $products->perPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
                'from' => $products->firstItem(),
                'to' => $products->lastItem(),
            ],
            'links' => [
                'first' => $products->url(1),
                'prev' => $products->previousPageUrl(),
                'next' => $products->nextPageUrl(),
                'last' => $products->url($products->lastPage()),
            ],
        ];
    }

    /**
     * GET /api/v1/products/{slug}
     *
     * @throws NotFoundHttpException when the slug is unknown or unpublished
     */
    public function show(string $slug): JsonResponse
    {
        $product = $this->catalogService->publishedProductBySlug($slug);

        if ($product === null) {
            throw new NotFoundHttpException("Product [{$slug}] not found.");
        }

        return ApiResponse::success(
            ProductResource::make($product),
            'اطلاعات محصول با موفقیت دریافت شد.',
        );
    }
}
