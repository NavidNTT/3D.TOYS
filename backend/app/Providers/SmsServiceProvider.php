<?php

namespace App\Providers;

use App\Services\Sms\Contracts\SmsGatewayInterface;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

/**
 * Binds the SMS contract to the driver configured in config/sms.php.
 *
 * Because every consumer type-hints SmsGatewayInterface, switching providers
 * (log -> kavenegar -> ...) never touches business logic: change SMS_GATEWAY
 * in the environment and the container resolves the new driver.
 */
class SmsServiceProvider extends ServiceProvider
{
    /**
     * Register the SMS gateway binding.
     */
    public function register(): void
    {
        $this->app->singleton(SmsGatewayInterface::class, function (Application $app): SmsGatewayInterface {
            $name = (string) config('sms.default');
            $config = config("sms.gateways.{$name}");

            if (! is_array($config) || blank($config['driver'] ?? null)) {
                throw new InvalidArgumentException(
                    "SMS gateway [{$name}] is not configured. Add it to config/sms.php or check SMS_GATEWAY.",
                );
            }

            if (! class_exists($config['driver'])) {
                throw new InvalidArgumentException(
                    "SMS gateway driver [{$config['driver']}] for [{$name}] does not exist.",
                );
            }

            // Extra config keys are ignored; matching ones ("channel") are
            // injected by name into the driver's constructor.
            return $app->make($config['driver'], $config);
        });
    }
}
