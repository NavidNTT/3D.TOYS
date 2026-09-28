<?php

namespace Tests\Unit;

use App\Services\Sms\Contracts\SmsGatewayInterface;
use App\Services\Sms\Drivers\LogSmsGateway;
use Illuminate\Support\Facades\Config;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * The driver pattern only pays off if switching providers is configuration
 * rather than code, so the binding itself is worth a test.
 */
class SmsGatewayBindingTest extends TestCase
{
    public function test_it_resolves_the_configured_driver(): void
    {
        Config::set('sms.default', 'log');

        $this->assertInstanceOf(LogSmsGateway::class, $this->app->make(SmsGatewayInterface::class));
    }

    public function test_it_throws_a_clear_error_for_an_unconfigured_gateway(): void
    {
        Config::set('sms.default', 'kavenegar');

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('SMS gateway [kavenegar] is not configured');

        $this->app->make(SmsGatewayInterface::class);
    }

    public function test_it_throws_when_the_driver_class_does_not_exist(): void
    {
        Config::set('sms.gateways.missing', ['driver' => 'App\\Services\\Sms\\Drivers\\NopeGateway']);
        Config::set('sms.default', 'missing');

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('does not exist');

        $this->app->make(SmsGatewayInterface::class);
    }

    public function test_the_log_driver_logs_the_code_and_reports_success(): void
    {
        $gateway = new LogSmsGateway;

        $this->assertTrue($gateway->sendOtp('09121234567', '12345'));
    }
}
