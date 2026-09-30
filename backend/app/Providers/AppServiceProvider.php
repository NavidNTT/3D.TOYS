<?php

namespace App\Providers;

use App\Models\ProductMedia3D;
use App\Observers\ProductMedia3DObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();

        // Draco pipeline: auto-dispatch optimization when a 3D file is set.
        // The observer covers the canonical ProductMedia3D model; the legacy
        // Media3d model self-registers its own dispatch hooks in booted()
        // (it is the model Filament's `relationship('media3d')` saves through).
        // Separate Eloquent classes => separate events => no double dispatch.
        ProductMedia3D::observe(ProductMedia3DObserver::class);
    }

    /**
     * Register the application's rate limiters.
     *
     * These live here rather than in bootstrap/app.php: the middleware
     * configuration closure in that file is invoked while the console/HTTP
     * kernel is being resolved — before the application is bootstrapped — so
     * the RateLimiter facade is not available there yet.
     */
    private function configureRateLimiting(): void
    {
        // Baseline for the whole /api surface.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(60)
            ->by($request->user()?->id ?: $request->ip()));

        /*
         * OTP delivery — the core defence of passwordless login.
         *
         * The key combines the phone number with the caller's IP, so neither
         * dimension alone can be abused:
         *   - one number cannot be SMS-spammed (cost) or probed (enumeration)
         *   - one IP cannot rotate through numbers to bypass the per-number cap
         * The 2-minute window mirrors the OTP validity window; the hourly cap is
         * a hard ceiling on SMS spend per number.
         */
        RateLimiter::for('otp-send', function (Request $request) {
            $key = sprintf('%s|%s', (string) $request->input('phone'), $request->ip());

            return [
                Limit::perMinutes(2, 1)->by($key),
                Limit::perHour(5)->by($key),
            ];
        });

        /*
         * Verification is throttled separately: a 5-digit code has only 100k
         * possibilities, so an unthrottled endpoint would be brute-forceable
         * well inside the 2-minute validity window.
         */
        RateLimiter::for('otp-verify', function (Request $request) {
            $key = sprintf('%s|%s', (string) $request->input('phone'), $request->ip());

            return [
                Limit::perMinute(10)->by($key),
            ];
        });
    }
}
