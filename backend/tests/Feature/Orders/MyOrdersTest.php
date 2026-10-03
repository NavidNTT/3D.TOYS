<?php

namespace Tests\Feature\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MyOrdersTest extends TestCase
{
    use RefreshDatabase;

    private const MY_ORDERS = '/api/v1/orders/my-orders';

    /**
     * Authenticate the way the SPA does: a real Sanctum personal access token
     * sent as a bearer header, so the auth middleware is genuinely exercised.
     */
    private function authenticate(): User
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth-token')->plainTextToken;

        $this->withToken($token);

        return $user;
    }

    /**
     * A placed order with one line, created directly so each test controls the
     * timestamp, status and ownership it cares about.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function placeOrder(User $user, array $overrides = []): Order
    {
        $product = Product::factory()->create();

        // `created_at` is not mass assignable, so it is forced on after insert.
        $createdAt = $overrides['created_at'] ?? null;
        unset($overrides['created_at']);

        $order = Order::query()->create(array_merge([
            'user_id' => $user->id,
            'order_number' => 'TS-260930-ABC123',
            'total_amount' => 2_500_000,
            'status' => OrderStatus::Pending,
            'receiver_name' => 'علی رضایی',
            'receiver_phone' => '09121234567',
            'province' => 'تهران',
            'city' => 'تهران',
            'address' => 'خیابان آزادی، پلاک ۱۲، واحد ۳',
            'postal_code' => '1234567890',
            'notes' => 'لطفاً پیش از ارسال تماس بگیرید.',
        ], $overrides));

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_title' => 'ربات حلبی',
            'quantity' => 2,
            'unit_price' => 1_250_000,
            'total_price' => 2_500_000,
        ]);

        if ($createdAt !== null) {
            $order->forceFill(['created_at' => $createdAt])->saveQuietly();
        }

        return $order;
    }

    public function test_a_guest_cannot_list_orders(): void
    {
        $this->getJson(self::MY_ORDERS)
            ->assertStatus(401)
            ->assertJson(['success' => false]);
    }

    public function test_it_lists_only_the_authenticated_users_orders_with_items(): void
    {
        $user = $this->authenticate();
        $order = $this->placeOrder($user);

        // Someone else's order must never appear.
        $other = User::factory()->create();
        $this->placeOrder($other, ['order_number' => 'TS-260930-OTH999']);

        $response = $this->getJson(self::MY_ORDERS)->assertStatus(200);

        $response
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $order->id)
            ->assertJsonPath('data.0.order_number', $order->order_number)
            ->assertJsonPath('data.0.status', 'pending')
            ->assertJsonPath('data.0.receiver_name', 'علی رضایی')
            ->assertJsonPath('data.0.city', 'تهران')
            ->assertJsonPath('data.0.items.0.product_title', 'ربات حلبی')
            ->assertJsonPath('data.0.items.0.quantity', 2);

        $this->assertSame(2_500_000, $response->json('data.0.total_amount'));
        $this->assertSame(1_250_000, $response->json('data.0.items.0.unit_price'));
        $this->assertSame(2_500_000, $response->json('data.0.items.0.total_price'));
    }

    public function test_it_returns_orders_newest_first(): void
    {
        $user = $this->authenticate();

        $older = $this->placeOrder($user, [
            'order_number' => 'TS-260901-OLD001',
            'created_at' => now()->subDay(),
        ]);
        $newer = $this->placeOrder($user, [
            'order_number' => 'TS-260930-NEW001',
            'created_at' => now(),
        ]);

        $this->getJson(self::MY_ORDERS)
            ->assertStatus(200)
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $older->id);
    }

    public function test_it_returns_an_empty_list_when_the_customer_has_no_orders(): void
    {
        $this->authenticate();

        $this->getJson(self::MY_ORDERS)
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonCount(0, 'data');
    }
}
