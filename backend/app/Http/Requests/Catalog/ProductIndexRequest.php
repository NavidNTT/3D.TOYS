<?php

namespace App\Http\Requests\Catalog;

use App\Services\Catalog\CatalogService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the public product listing: GET /api/v1/products.
 *
 * The endpoint is read-only and unauthenticated, so the only job here is to
 * keep the query string inside sane bounds before it reaches the service:
 * `per_page` is capped so one request cannot pull the whole catalog, and the
 * string filters are length-limited so an overlong term cannot be used to build
 * an expensive `LIKE`.
 */
class ProductIndexRequest extends FormRequest
{
    /** Public catalog reads: no authorization to perform. */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', 'max:255'],
            'in_stock' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.CatalogService::MAX_PER_PAGE],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'search' => 'عبارت جستجو',
            'category' => 'دسته‌بندی',
            'in_stock' => 'فقط کالاهای موجود',
            'page' => 'شماره صفحه',
            'per_page' => 'تعداد در هر صفحه',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'search.max' => 'عبارت جستجو نباید بیشتر از ۱۰۰ نویسه باشد.',
            'in_stock.boolean' => 'فیلتر موجودی باید بله یا خیر باشد.',
            'page.integer' => 'شماره صفحه باید یک عدد باشد.',
            'page.min' => 'شماره صفحه باید حداقل ۱ باشد.',
            'per_page.integer' => 'تعداد در هر صفحه باید یک عدد باشد.',
            'per_page.min' => 'تعداد در هر صفحه باید حداقل ۱ باشد.',
            'per_page.max' => 'تعداد در هر صفحه نباید بیشتر از '.CatalogService::MAX_PER_PAGE.' باشد.',
        ];
    }
}