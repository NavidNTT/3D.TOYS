<?php

namespace App\Http\Requests\Orders;

use App\Support\IranianMobileNumber;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates POST /api/v1/orders/checkout.
 *
 * Only identities and quantities come from the client. No price, line total or
 * grand total is accepted anywhere in this payload — the service reads them from
 * the locked product rows, so a tampered request cannot change what is charged.
 */
class CheckoutRequest extends FormRequest
{
    /**
     * The route sits behind auth:sanctum, so reaching this point already means
     * an authenticated customer; guests are rejected before validation runs.
     */
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
            'receiver_name' => ['required', 'string', 'min:2', 'max:255'],
            'receiver_phone' => ['required', 'string', 'regex:'.IranianMobileNumber::PATTERN],
            'province' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'address' => ['required', 'string', 'min:10', 'max:1000'],
            'postal_code' => ['required', 'string', 'regex:/^[0-9]{10}$/'],
            'notes' => ['nullable', 'string', 'max:1000'],

            'items' => ['required', 'array', 'min:1', 'max:50'],
            // Capped at the same ceiling the storefront's stepper enforces.
            // `distinct` rejects the same product twice: the cart merges lines,
            // so a repeat means the payload was built by hand.
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'receiver_name' => 'نام گیرنده',
            'receiver_phone' => 'شماره تماس',
            'province' => 'استان',
            'city' => 'شهر',
            'address' => 'نشانی',
            'postal_code' => 'کد پستی',
            'notes' => 'توضیحات',
            'items' => 'اقلام سفارش',
            'items.*.product_id' => 'شناسه محصول',
            'items.*.quantity' => 'تعداد',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'receiver_name.required' => 'وارد کردن نام گیرنده الزامی است.',
            'receiver_name.min' => 'نام گیرنده باید حداقل ۲ نویسه باشد.',
            'receiver_phone.required' => 'وارد کردن شماره تماس الزامی است.',
            'receiver_phone.regex' => 'شماره تماس باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.',
            'province.required' => 'وارد کردن استان الزامی است.',
            'city.required' => 'وارد کردن شهر الزامی است.',
            'address.required' => 'وارد کردن نشانی الزامی است.',
            'address.min' => 'نشانی باید حداقل ۱۰ نویسه باشد.',
            'postal_code.required' => 'وارد کردن کد پستی الزامی است.',
            'postal_code.regex' => 'کد پستی باید ۱۰ رقم عددی باشد.',
            'items.required' => 'سبد خرید خالی است.',
            'items.min' => 'سبد خرید خالی است.',
            'items.*.product_id.required' => 'شناسه محصول ارسال نشده است.',
            'items.*.product_id.exists' => 'یکی از محصولات سبد خرید یافت نشد.',
            'items.*.product_id.distinct' => 'یک محصول بیش از یک بار در سبد خرید تکرار شده است.',
            'items.*.quantity.required' => 'تعداد هر محصول الزامی است.',
            'items.*.quantity.min' => 'تعداد هر محصول باید حداقل ۱ باشد.',
            'items.*.quantity.max' => 'حداکثر تعداد قابل سفارش برای هر محصول ۹۹ عدد است.',
        ];
    }
}
