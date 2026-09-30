<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Services\Catalog\CatalogService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
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
     * GET /api/v1/products
     *
     * Only published products are listed; each one carries its category (for
     * theming) and its 3D asset (for the viewer).
     */
    public function index(): JsonResponse
    {
        return ApiResponse::success(
            ProductResource::collection($this->catalogService->publishedProducts()),
            'فهرست محصولات با موفقیت دریافت شد.',
        );
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
