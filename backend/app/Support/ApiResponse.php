<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

/**
 * Every JSON response leaves the API through here, so clients can rely on one
 * shape across success and error cases:
 *
 *   { "success": bool, "message": string, "data": object|array|null }
 */
final class ApiResponse
{
    /**
     * @param  mixed  $data  payload (resource, array, scalar or null)
     */
    public static function success(mixed $data = null, string $message = 'عملیات با موفقیت انجام شد.', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    /**
     * @param  mixed  $data  error details (validation errors, reason, null)
     */
    public static function error(string $message, mixed $data = null, int $status = 422): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => $data,
        ], $status);
    }
}
