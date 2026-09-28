<?php

namespace App\Services\Sms\Drivers;

use App\Services\Sms\Contracts\SmsGatewayInterface;
use Illuminate\Support\Facades\Log;

/**
 * Development gateway: writes the OTP to the Laravel log instead of sending an
 * SMS. This is what makes the whole login flow testable locally — request a
 * code, then read it from wherever the application logs:
 *
 *     inside Docker (LOG_CHANNEL=stderr):
 *         docker compose --env-file .env.docker logs laravel.app | grep 'SMS:log' | tail -1
 *
 *     on the host or with a file channel:
 *         grep 'SMS:log' storage/logs/laravel.log | tail -1
 *
 * The channel can be pinned with SMS_LOG_CHANNEL (see config/sms.php).
 */
class LogSmsGateway implements SmsGatewayInterface
{
    /**
     * @param  string|null  $channel  Log channel to write to (null = default channel)
     */
    public function __construct(
        private readonly ?string $channel = null,
    ) {}

    /**
     * {@inheritDoc}
     */
    public function sendOtp(string $phone, string $code): bool
    {
        $message = sprintf(
            '[SMS:log] OTP for %s is %s (valid %d minutes)',
            $phone,
            $code,
            (int) config('sms.otp.ttl_minutes', 2),
        );

        $context = [
            'phone' => $phone,
            'code' => $code,
            'gateway' => self::class,
        ];

        if ($this->channel !== null && $this->channel !== '') {
            Log::channel($this->channel)->info($message, $context);
        } else {
            Log::info($message, $context);
        }

        return true;
    }
}
