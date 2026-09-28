<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Services\Auth\AuthService;
use App\Services\Auth\OtpService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Passwordless authentication endpoints.
 *
 * The controller only translates HTTP into service calls and back: every rule,
 * hash and token decision lives in the service layer, and every error is
 * shaped by the handler in bootstrap/app.php.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly OtpService $otpService,
        private readonly AuthService $authService,
    ) {}

    /**
     * POST /api/v1/auth/otp/send
     *
     * Always 200 for a well-formed number, whether or not the account exists:
     * the response must not reveal which numbers are registered.
     */
    public function sendOtp(SendOtpRequest $request): JsonResponse
    {
        $this->otpService->sendCode($request->validated('phone'));

        return ApiResponse::success(null, 'کد تأیید با موفقیت ارسال شد.');
    }

    /**
     * POST /api/v1/auth/otp/verify
     *
     * Verifies the code, registers the user on first login, and returns a
     * Sanctum bearer token.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        $result = $this->authService->verifyAndLogin(
            $request->validated('phone'),
            $request->validated('code'),
        );

        return ApiResponse::success([
            'user' => UserResource::make($result['user']),
            'token' => $result['token'],
            'token_type' => 'Bearer',
        ], 'ورود با موفقیت انجام شد.');
    }

    /**
     * GET /api/v1/auth/me (auth:sanctum)
     */
    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success(
            UserResource::make($request->user()),
            'اطلاعات کاربر با موفقیت دریافت شد.',
        );
    }

    /**
     * POST /api/v1/auth/logout (auth:sanctum)
     *
     * Revokes only the token used for this request, so other devices stay
     * logged in.
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        // Session-based (SPA) requests carry a TransientToken, which has no
        // database row to delete — the session guard owns that lifecycle.
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        return ApiResponse::success(null, 'با موفقیت خارج شدید.');
    }
}
