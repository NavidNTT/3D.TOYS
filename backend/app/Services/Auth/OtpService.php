<?php

namespace App\Services\Auth;

use App\Exceptions\SmsDeliveryFailedException;
use App\Models\OtpCode;
use App\Services\Sms\Contracts\SmsGatewayInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Issues and verifies one-time passwords.
 *
 * Security properties:
 *  - codes come from random_int() (CSPRNG), never rand()/mt_rand()
 *  - only the bcrypt hash is stored, so a database leak yields no usable code
 *  - exactly one active code per phone number; a new request invalidates older ones
 *  - codes are single-use and short-lived (config('sms.otp.ttl_minutes'))
 */
class OtpService
{
    public function __construct(
        private readonly SmsGatewayInterface $smsGateway,
    ) {}

    /**
     * Generate a code and send it through the configured gateway.
     *
     * @throws SmsDeliveryFailedException when the gateway refuses the message
     */
    public function sendCode(string $phone): void
    {
        $code = $this->generateCode($phone);

        if (! $this->smsGateway->sendOtp($phone, $code)) {
            // A code the user never received must never stay valid.
            OtpCode::query()->where('phone', $phone)->delete();

            throw new SmsDeliveryFailedException;
        }
    }

    /**
     * Create, hash and persist a fresh code for the phone number.
     *
     * @return string the plaintext code (handed to the gateway, never stored)
     */
    public function generateCode(string $phone): string
    {
        $code = (string) random_int(
            (int) config('sms.otp.min', 10000),
            (int) config('sms.otp.max', 99999),
        );

        DB::transaction(function () use ($phone, $code): void {
            // Invalidate any previous challenge: one live code per number.
            OtpCode::query()->where('phone', $phone)->delete();

            OtpCode::query()->create([
                'phone' => $phone,
                'code' => Hash::make($code),
                'expires_at' => now()->addMinutes((int) config('sms.otp.ttl_minutes', 2)),
            ]);
        });

        return $code;
    }

    /**
     * Check a code and consume it on success.
     */
    public function verifyCode(string $phone, string $code): bool
    {
        $otp = OtpCode::query()
            ->where('phone', $phone)
            ->active()
            ->orderByDesc('id')
            ->first();

        if ($otp === null || ! Hash::check($code, $otp->code)) {
            // Wrong or missing code: leave a valid challenge in place so the
            // legitimate owner can still use the SMS they received.
            return false;
        }

        $otp->delete();

        return true;
    }

    /**
     * Remove expired challenges. Called by the scheduled housekeeping command.
     */
    public function purgeExpired(): int
    {
        return OtpCode::query()->where('expires_at', '<=', now())->delete();
    }
}
