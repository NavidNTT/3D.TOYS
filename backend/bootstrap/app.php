<?php

use App\Exceptions\ApiException;
use App\Support\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Applies the "api" limiter (60 requests/minute per user or IP) to
        // every route in routes/api.php. The limiter itself is registered in
        // AppServiceProvider: this closure runs before the application is
        // bootstrapped, so facades (RateLimiter) are not available here yet.
        $middleware->throttleApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API clients always get JSON, even without an Accept header.
        $wantsJson = static fn (Request $request): bool => $request->is('api/*') || $request->expectsJson();

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $e): bool => $wantsJson($request),
        );

        // Expected outcomes of the auth flow (bad OTP, throttled client,
        // missing token, invalid payload) are part of normal operation.
        // Reporting them would write a stack trace per rejected request and
        // bury genuine failures — a throttled attacker could even use it to
        // flood the logs.
        $exceptions->dontReport([
            ApiException::class,
            ThrottleRequestsException::class,
            AuthenticationException::class,
            ValidationException::class,
        ]);

        // Expected domain failures (invalid OTP, SMS outage, ...).
        $exceptions->render(function (ApiException $e, Request $request) use ($wantsJson) {
            if (! $wantsJson($request)) {
                return null;
            }

            return ApiResponse::error($e->getMessage(), $e->context(), $e->status());
        });

        // Validation failures, including every FormRequest rule.
        $exceptions->render(function (ValidationException $e, Request $request) use ($wantsJson) {
            if (! $wantsJson($request)) {
                return null;
            }

            return ApiResponse::error('دادههای ارسالی معتبر نیست.', $e->errors(), 422);
        });

        // Missing / expired bearer token.
        $exceptions->render(function (AuthenticationException $e, Request $request) use ($wantsJson) {
            if (! $wantsJson($request)) {
                return null;
            }

            return ApiResponse::error('برای دسترسی به این بخش باید وارد حساب خود شوید.', null, 401);
        });

        // Rate limiting, with Retry-After so clients can back off correctly.
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($wantsJson) {
            if (! $wantsJson($request)) {
                return null;
            }

            $retryAfter = (int) ($e->getHeaders()['Retry-After'] ?? 60);

            return ApiResponse::error(
                'تعداد درخواستهای شما بیش از حد مجاز است. لطفاً پس از '.$retryAfter.' ثانیه دوباره تلاش کنید.',
                ['reason' => 'too_many_requests', 'retry_after' => $retryAfter],
                429,
            )->header('Retry-After', (string) $retryAfter);
        });

        // Unknown API route.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) use ($wantsJson) {
            if (! $wantsJson($request)) {
                return null;
            }

            return ApiResponse::error('مسیر درخواستی یافت نشد.', null, 404);
        });
    })->create();
