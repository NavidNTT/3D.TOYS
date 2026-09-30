<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Services\Catalog\CatalogService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Public category listing.
 *
 * The storefront fetches this while rendering its home page, so it is
 * unauthenticated by design: names, slugs and palettes are public data.
 */
class CategoryController extends Controller
{
    public function __construct(
        private readonly CatalogService $catalogService,
    ) {}

    /**
     * GET /api/v1/categories
     */
    public function index(): JsonResponse
    {
        return ApiResponse::success(
            CategoryResource::collection($this->catalogService->categories()),
            'فهرست دسته‌بندی‌ها با موفقیت دریافت شد.',
        );
    }
}
