<?php

namespace App\Http\Requests\Auth;

/**
 * Validates POST /api/v1/auth/otp/send.
 */
class SendOtpRequest extends OtpRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'phone' => $this->phoneRules(),
        ];
    }
}
