<?php

namespace Tests\Support;

use App\Services\Sms\Contracts\SmsGatewayInterface;

/**
 * Swaps the bound SMS gateway for the recording fake.
 *
 * The application keeps depending on SmsGatewayInterface, so this replaces the
 * driver without touching a single line of production code.
 */
trait InteractsWithSmsGateway
{
    protected FakeSmsGateway $sms;

    protected function fakeSmsGateway(): FakeSmsGateway
    {
        $this->sms = new FakeSmsGateway;

        $this->app->instance(SmsGatewayInterface::class, $this->sms);

        return $this->sms;
    }
}
