<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Orders\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\Orders\OrderService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

/**
 * Order endpoints.
 *
 * Thin as the rest of the API: the controller picks validated input apart, hands
 * it to the service, and lets the handler in bootstrap/app.php shape any error.
 */
class OrderController extends Controller
{
    public function __construct(
        private readonly OrderService $orderService,
    ) {}

    /**
     * POST /api/v1/orders/checkout (auth:sanctum)
     *
     * The order belongs to the authenticated customer, and the amount charged is
     * whatever the service computed from the database — the payload carries only
     * product ids and quantities.
     */
    public function checkout(CheckoutRequest $request): JsonResponse
    {
        $order = $this->orderService->checkout(
            $request->user(),
            // `safe()` keeps extra keys out of the order: a payload cannot
            // smuggle in a `status` or `total_amount` of its own.
            $request->safe()->only([
                'receiver_name',
                'receiver_phone',
                'province',
                'city',
                'address',
                'postal_code',
                'notes',
            ]),
            $request->validated('items'),
        );

        return ApiResponse::success(
            OrderResource::make($order),
            'سفارش شما با موفقیت ثبت شد.',
            201,
        );
    }
}
