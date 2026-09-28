<?php

use App\Services\Sms\Drivers\LogSmsGateway;

return [

    /*
    |--------------------------------------------------------------------------
    | Default SMS gateway
    |--------------------------------------------------------------------------
    |
    | The driver used to deliver OTP messages. "log" writes the code to the
    | Laravel log so local development and tests need no real provider; swap
    | in a live gateway here (see the "gateways" list below) without touching
    | any application code.
    |
    */

    'default' => env('SMS_GATEWAY', 'log'),

    /*
    |--------------------------------------------------------------------------
    | OTP rules
    |--------------------------------------------------------------------------
    |
    | length      – digits in the generated code (surfaced in messages/tests)
    | min/max     – inclusive range for random_int(); 5 digits with no leading
    |               zeros, so "01234" can never be issued by accident
    | ttl_minutes – how long a code stays valid
    |
    */

    'otp' => [
        'length' => 5,
        'min' => 10000,
        'max' => 99999,
        'ttl_minutes' => 2,
    ],

    /*
    |--------------------------------------------------------------------------
    | Gateways
    |--------------------------------------------------------------------------
    |
    | Each entry maps a driver name to its class plus whatever options the
    | driver's constructor needs. The provider resolves the interface to the
    | selected driver, so adding Kavenegar/Ghasedak/etc. is a config entry and
    | one class — nothing else changes.
    |
    | 'kavenegar' => [
    |     'driver' => App\Services\Sms\Drivers\KavenegarSmsGateway::class,
    |     'api_key' => env('KAVENEGAR_API_KEY'),
    |     'sender' => env('KAVENEGAR_SENDER'),
    |     'template' => env('KAVENEGAR_OTP_TEMPLATE'),
    | ],
    |
    */

    'gateways' => [
        'log' => [
            'driver' => LogSmsGateway::class,
            // null = the application's default log channel
            'channel' => env('SMS_LOG_CHANNEL'),
        ],
    ],

];
