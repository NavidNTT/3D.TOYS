<?php

namespace Tests\Feature\Orders;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CheckoutTest extends TestCase
{
    use RefreshDatabase;

    private const CHECKOUT = '/api/v1/orders/checkout';

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
     * A valid shipping payload; individual tests override what they care about.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'receiver_name' => 'علی رضایی',
            'receiver_phone' => '09121234567',
            'province' => 'تهران',
            'city' => 'تهران',
            'address' => 'خیابان آزادی، پلاک ۱۲، واحد ۳',
            'postal_code' => '1234567890',
            'notes' => 'لطفاً پیش از ارسال تماس بگیرید.',
            'items' => [],
        ], $overrides);
    }

    public function test_a_guest_cannot_check_out(): void
    {
        $product = Product::factory()->pricedAt(1_000_000)->create(['stock' => 5]);

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]))
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'برای دسترسی به این بخش باید وارد حساب خود شوید.',
            ]);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(5, $product->fresh()->stock);
    }

    public function test_it_places_an_order_and_decrements_stock(): void
    {
        $user = $this->authenticate();
        $product = Product::factory()->pricedAt(1_250_000)->create([
            'title' => 'ربات حلبی',
            'stock' => 10,
        ]);

        $response = $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ]));

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'سفارش شما با موفقیت ثبت شد.',
            ])
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.status_label', 'در انتظار پرداخت')
            ->assertJsonPath('data.receiver_name', 'علی رضایی')
            ->assertJsonPath('data.receiver_phone', '09121234567')
            ->assertJsonPath('data.items.0.product_title', 'ربات حلبی')
            ->assertJsonPath('data.items.0.quantity', 2);

        // Money is returned as JSON integers: one Toman is the smallest unit, so
        // there is no decimal part to round and no float noise to defend against.
        $this->assertSame(2_500_000, $response->json('data.total_amount'));
        $this->assertSame(1_250_000, $response->json('data.items.0.unit_price'));
        $this->assertSame(2_500_000, $response->json('data.items.0.total_price'));

        $this->assertMatchesRegularExpression(
            '/^TS-\d{6}-[A-Z0-9]{6}$/',
            (string) $response->json('data.order_number'),
        );

        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'status' => OrderStatus::Pending->value,
            'total_amount' => 2_500_000,
        ]);

        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'product_title' => 'ربات حلبی',
            'unit_price' => 1_250_000,
            'quantity' => 2,
            'total_price' => 2_500_000,
        ]);

        // Stock really moved.
        $this->assertSame(8, $product->fresh()->stock);
    }

    public function test_prices_come_from_the_database_not_the_request(): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(500_000)->create(['stock' => 5]);

        // A tampered client: every amount it could try to inject.
        $response = $this->postJson(self::CHECKOUT, $this->payload([
            'total_amount' => 1,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
                'unit_price' => 0.5,
                'price' => 0.5,
                'total_price' => 1,
                'product_title' => 'ارزان',
            ]],
        ]));

        $response->assertStatus(201);

        // 2 × 500,000 from the row; nothing the client sent is stored.
        $this->assertSame(1_000_000, $response->json('data.total_amount'));
        $this->assertSame(500_000, $response->json('data.items.0.unit_price'));

        $this->assertDatabaseHas('orders', ['total_amount' => 1_000_000]);
        $this->assertDatabaseMissing('orders', ['total_amount' => 1]);
        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'unit_price' => 500_000,
            'total_price' => 1_000_000,
        ]);
        $this->assertSame(3, $product->fresh()->stock);
    }

    public function test_it_sums_several_lines(): void
    {
        $this->authenticate();
        $first = Product::factory()->pricedAt(1_025_000)->create(['stock' => 10]);
        $second = Product::factory()->pricedAt(375_000)->create(['stock' => 10]);

        $response = $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [
                ['product_id' => $first->id, 'quantity' => 3],
                ['product_id' => $second->id, 'quantity' => 4],
            ],
        ]));

        // 3,075,000 + 1,500,000
        $this->assertSame(4_575_000, $response->json('data.total_amount'));

        $this->assertSame(7, $first->fresh()->stock);
        $this->assertSame(6, $second->fresh()->stock);
    }

    public function test_it_rejects_a_quantity_beyond_stock_without_touching_anything(): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(300_000)->create([
            'title' => 'خرس پولیشی',
            'stock' => 2,
        ]);

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 5]],
        ]))
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'موجودی «خرس پولیشی» کافی نیست. تعداد قابل سفارش: 2',
            ])
            ->assertJsonPath('data.reason', 'insufficient_stock')
            ->assertJsonPath('data.product_id', $product->id)
            ->assertJsonPath('data.requested', 5)
            ->assertJsonPath('data.available', 2);

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertSame(2, $product->fresh()->stock);
    }

    public function test_one_rejected_line_rolls_back_the_whole_order(): void
    {
        $this->authenticate();
        $fine = Product::factory()->pricedAt(1_000_000)->create(['stock' => 10]);
        $scarce = Product::factory()->pricedAt(1_000_000)->create(['stock' => 1]);

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [
                // Valid on its own: this stock must survive the rollback.
                ['product_id' => $fine->id, 'quantity' => 2],
                ['product_id' => $scarce->id, 'quantity' => 5],
            ],
        ]))
            ->assertStatus(422)
            ->assertJsonPath('data.reason', 'insufficient_stock');

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('order_items', 0);
        $this->assertSame(10, $fine->fresh()->stock);
        $this->assertSame(1, $scarce->fresh()->stock);
    }

    public function test_a_published_product_with_no_stock_is_rejected(): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(1_000_000)->outOfStock()->create();

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]))
            ->assertStatus(422)
            ->assertJsonPath('data.reason', 'insufficient_stock')
            ->assertJsonPath('data.available', 0);

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_an_unpublished_product_cannot_be_ordered(): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(1_000_000)->inactive()->create([
            'title' => 'محصول آرشیو شده',
            'stock' => 10,
        ]);

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]))
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => '«محصول آرشیو شده» در حال حاضر قابل خریداری نیست.',
            ])
            ->assertJsonPath('data.reason', 'product_unavailable')
            ->assertJsonPath('data.product_id', $product->id);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_the_order_belongs_to_the_authenticated_customer(): void
    {
        $buyer = User::factory()->create();
        $other = User::factory()->create();
        $this->withToken($buyer->createToken('auth-token')->plainTextToken);

        $product = Product::factory()->pricedAt(999_000)->create(['stock' => 3]);

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]))->assertStatus(201);

        $this->assertDatabaseHas('orders', ['user_id' => $buyer->id]);
        $this->assertDatabaseMissing('orders', ['user_id' => $other->id]);
        $this->assertSame(1, $buyer->orders()->count());
        $this->assertSame(0, $other->orders()->count());
    }

    public function test_order_numbers_are_unique_and_traceable(): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(500_000)->create(['stock' => 10]);

        $first = $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]))->assertStatus(201)->json('data.order_number');

        $second = $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]))->assertStatus(201)->json('data.order_number');

        $this->assertNotSame($first, $second);
        $this->assertDatabaseCount('orders', 2);
        $this->assertDatabaseHas('orders', ['order_number' => $first]);
        $this->assertDatabaseHas('orders', ['order_number' => $second]);
    }

    public function test_a_placed_order_keeps_its_snapshot_when_the_product_changes(): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(2_000_000)->create([
            'title' => 'نام قدیمی',
            'stock' => 5,
        ]);

        $this->postJson(self::CHECKOUT, $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ]))->assertStatus(201);

        // The catalog moves on: rename + reprice.
        $product->update(['title' => 'نام جدید', 'price' => 99_900_000]);

        $order = Order::query()->sole();

        $this->assertSame(4_000_000, $order->total_amount);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_title' => 'نام قدیمی',
            'unit_price' => 2_000_000,
            'total_price' => 4_000_000,
        ]);
    }

    #[DataProvider('invalidPayloads')]
    public function test_it_validates_the_shipping_details(array $mutations, string $invalidKey): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(1_000_000)->create(['stock' => 10]);

        $payload = $this->payload([
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ]);

        foreach ($mutations as $key => $value) {
            if ($value === null) {
                unset($payload[$key]);

                continue;
            }

            $payload[$key] = $value;
        }

        $this->postJson(self::CHECKOUT, $payload)
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonStructure(['success', 'message', 'data' => [$invalidKey]]);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $product->fresh()->stock);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidPayloads(): array
    {
        return [
            'missing receiver name' => [['receiver_name' => null], 'receiver_name'],
            'one-character receiver name' => [['receiver_name' => 'ا'], 'receiver_name'],
            'missing receiver phone' => [['receiver_phone' => null], 'receiver_phone'],
            'landline instead of mobile' => [['receiver_phone' => '02112345678'], 'receiver_phone'],
            'missing province' => [['province' => null], 'province'],
            'missing city' => [['city' => null], 'city'],
            'missing address' => [['address' => null], 'address'],
            'too short address' => [['address' => 'کوتاه'], 'address'],
            'missing postal code' => [['postal_code' => null], 'postal_code'],
            'postal code too short' => [['postal_code' => '12345'], 'postal_code'],
            'postal code with letters' => [['postal_code' => '12345abcde'], 'postal_code'],
            'empty cart' => [['items' => []], 'items'],
        ];
    }

    #[DataProvider('invalidItems')]
    public function test_it_validates_each_cart_line(array $items, string $invalidKey): void
    {
        $this->authenticate();
        $product = Product::factory()->pricedAt(1_000_000)->create(['stock' => 10]);

        // Resolve the placeholder so those cases point at a real row.
        $items = array_map(static function (array $item) use ($product): array {
            if (($item['product_id'] ?? null) === 'PRODUCT') {
                $item['product_id'] = $product->id;
            }

            return $item;
        }, $items);

        $this->postJson(self::CHECKOUT, $this->payload(['items' => $items]))
            ->assertStatus(422)
            ->assertJsonStructure(['success', 'message', 'data' => [$invalidKey]]);

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $product->fresh()->stock);
    }

    /**
     * @return array<string, array{0: array<int, array<string, mixed>>, 1: string}>
     */
    public static function invalidItems(): array
    {
        return [
            'quantity zero' => [[['product_id' => 'PRODUCT', 'quantity' => 0]], 'items.0.quantity'],
            'quantity beyond the cap' => [[['product_id' => 'PRODUCT', 'quantity' => 100]], 'items.0.quantity'],
            'quantity missing' => [[['product_id' => 'PRODUCT']], 'items.0.quantity'],
            'quantity not an integer' => [[['product_id' => 'PRODUCT', 'quantity' => 1.5]], 'items.0.quantity'],
            'product missing' => [[['quantity' => 1]], 'items.0.product_id'],
            'unknown product' => [[['product_id' => 999999, 'quantity' => 1]], 'items.0.product_id'],
            'product id not numeric' => [[['product_id' => 'abc', 'quantity' => 1]], 'items.0.product_id'],
            'duplicate product' => [[
                ['product_id' => 'PRODUCT', 'quantity' => 1],
                ['product_id' => 'PRODUCT', 'quantity' => 2],
            ], 'items.0.product_id'],
        ];
    }
}
