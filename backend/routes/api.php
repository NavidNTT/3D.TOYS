<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\ProductController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API routes (prefixed with /api by the framework)
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Catalog — public, cache-friendly reads for the storefront
|--------------------------------------------------------------------------
|
| The Next.js server components fetch these while rendering the home page and
| the product pages (frontend/src/services/categoryService.ts,
| frontend/src/services/productService.ts), so they must stay
| unauthenticated: names, prices and stock are public product data. Writes go
| through the Filament admin panel, never through this API.
|
| The `api` limiter (60/minute) still applies, which is plenty for a page
| whose fetches are cached for 30 seconds.
*/
Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::get('categories', [CategoryController::class, 'index'])->name('categories.index');

    Route::get('products', [ProductController::class, 'index'])->name('products.index');

    // Declared after the collection so `/products` matches first; a literal
    // segment registered below `{slug}` would be swallowed by it.
    Route::get('products/{slug}', [ProductController::class, 'show'])->name('products.show');
});

Route::prefix('v1/auth')->name('api.v1.auth.')->group(function (): void {
    // Public: request a one-time password. Throttled to 1 request / 2 minutes
    // and 5 requests / hour per phone + IP (see bootstrap/app.php).
    Route::post('otp/send', [AuthController::class, 'sendOtp'])
        ->middleware('throttle:otp-send')
        ->name('otp.send');

    // Public: exchange a valid OTP for a Sanctum token. Extra throttle on top
    // of the send limiter to make brute-forcing a 5-digit code impractical.
    Route::post('otp/verify', [AuthController::class, 'verifyOtp'])
        ->middleware('throttle:otp-verify')
        ->name('otp.verify');

    // Authenticated with `Authorization: Bearer <token>`.
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
    });
});

Route::middleware('auth:sanctum')->prefix('v1/orders')->name('api.v1.orders.')->group(function (): void {
    // Checkout requires an account: the order must belong to someone, so the
    // customer can track it and the shop can fulfil it. Guests are stopped by
    // the middleware before any validation runs.
    Route::post('checkout', [OrderController::class, 'checkout'])->name('checkout');

    // The customer's own order history. Literal segment, and a GET, so it can
    // never be mistaken for the checkout POST above.
    Route::get('my-orders', [OrderController::class, 'myOrders'])->name('my-orders');
});
