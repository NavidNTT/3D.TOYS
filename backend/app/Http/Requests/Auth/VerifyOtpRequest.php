<?php

namespace App\Http\Requests\Auth;

/**
 * Validates POST /api/v1/auth/otp/verify.
 *
 * `digits:5` is used rather than `size:5` so the payload must be five ASCII
 * digits — a code like "1234۵" (Persian digit) or "12 45" never reaches the
 * hashing check.
 */
class VerifyOtpRequest extends OtpRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => $this->phoneRules(),
            'code' => ['required', 'string', 'digits:5'],
        ];
    }
}
