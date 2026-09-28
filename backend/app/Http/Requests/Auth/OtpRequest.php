<?php

namespace App\Http\Requests\Auth;

use App\Support\IranianMobileNumber;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Shared validation for the OTP endpoints.
 *
 * Keeping the mobile-number rule in one place means the send and verify
 * endpoints can never drift apart on what a valid Iranian number is.
 */
abstract class OtpRequest extends FormRequest
{
    /**
     * Iranian mobile numbers: 09 followed by exactly 9 digits.
     */
    public const PHONE_REGEX = IranianMobileNumber::PATTERN;

    /**
     * All OTP endpoints are public; authorisation happens after verification.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<int, string>
     */
    protected function phoneRules(): array
    {
        return ['required', 'string', 'regex:'.self::PHONE_REGEX];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'phone' => 'شماره موبایل',
            'code' => 'کد تأیید',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'phone.required' => 'وارد کردن شماره موبایل الزامی است.',
            'phone.string' => 'شماره موبایل باید به صورت متن ارسال شود.',
            'phone.regex' => 'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم داشته باشد.',
            'code.required' => 'وارد کردن کد تأیید الزامی است.',
            'code.string' => 'کد تأیید باید به صورت متن ارسال شود.',
            'code.digits' => 'کد تأیید باید ۵ رقم عددی باشد.',
        ];
    }
}
