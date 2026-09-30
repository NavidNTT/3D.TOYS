<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Filament\Resources\CategoryResource;
use App\Filament\Resources\OrderResource;
use App\Filament\Resources\ProductResource;
use App\Models\Category;
use App\Models\Media3d;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FilamentAdminPanelTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_from_admin_panel(): void
    {
        $response = $this->get('/admin');

        $response->assertRedirect('/admin/login');
    }

    public function test_customer_cannot_access_admin_panel(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
        ]);

        $panel = Filament::getPanel('admin');

        $this->assertFalse($customer->canAccessPanel($panel));

        $response = $this->actingAs($customer)->get('/admin');
        $response->assertForbidden();
    }

    public function test_admin_can_access_admin_panel(): void
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
        ]);

        $panel = Filament::getPanel('admin');

        $this->assertTrue($admin->canAccessPanel($panel));

        $response = $this->actingAs($admin)->get('/admin');
        $response->assertSuccessful();
    }

    public function test_admin_can_view_category_resource_pages(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $category = Category::query()->create([
            'name' => 'Robots',
            'slug' => 'robots',
            'description' => 'Cool robots',
            'theme_config' => [
                'primary_color' => '#ff0000',
                'accent_color' => '#00ff00',
                'badge_text' => 'HOT',
                'background_style' => 'midnight',
            ],
        ]);

        $this->actingAs($admin)->get(CategoryResource::getUrl('index'))->assertSuccessful();
        $this->actingAs($admin)->get(CategoryResource::getUrl('create'))->assertSuccessful();
        $this->actingAs($admin)->get(CategoryResource::getUrl('edit', ['record' => $category]))->assertSuccessful();
    }

    public function test_admin_can_view_product_resource_pages_with_3d_media(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);

        $category = Category::query()->create([
            'name' => 'Action Figures',
            'slug' => 'action-figures',
        ]);

        $product = Product::query()->create([
            'category_id' => $category->id,
            'title' => 'Vintage Astro Robot',
            'name' => 'Vintage Astro Robot',
            'slug' => 'vintage-astro-robot',
            'sku' => 'TOY-ASTRO-001',
            'price' => 49.99,
            'stock' => 10,
            'status' => 'active',
            'attributes' => [
                'Material' => 'Die-cast metal',
                'Scale' => '1:12',
            ],
        ]);

        Media3d::query()->create([
            'product_id' => $product->id,
            'original_file_url' => 'models/3d/astro.glb',
            'thumbnail_url' => 'models/thumbnails/astro.png',
            'lighting_preset' => 'studio',
            'camera_settings' => ['initial_fov' => 50],
            'auto_rotate' => true,
            'rotation_speed' => 1.5,
        ]);

        $this->actingAs($admin)->get(ProductResource::getUrl('index'))->assertSuccessful();
        $this->actingAs($admin)->get(ProductResource::getUrl('create'))->assertSuccessful();
        $this->actingAs($admin)->get(ProductResource::getUrl('edit', ['record' => $product]))->assertSuccessful();
    }

    public function test_admin_can_view_order_resource_pages_but_cannot_create_orders(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin]);
        $customer = User::factory()->create(['role' => UserRole::Customer]);
        $product = Product::factory()->create();

        $order = Order::query()->create([
            'user_id' => $customer->id,
            'order_number' => 'TS-260930-ABC123',
            'total_amount' => 241.00,
            'status' => OrderStatus::Pending,
            'receiver_name' => 'علی رضایی',
            'receiver_phone' => '09121234567',
            'province' => 'تهران',
            'city' => 'تهران',
            'address' => 'خیابان آزادی، پلاک ۱۲، واحد ۳',
            'postal_code' => '1234567890',
            'notes' => 'لطفاً پیش از ارسال تماس بگیرید.',
        ]);

        OrderItem::query()->create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_title' => 'ربات حلبی',
            'quantity' => 2,
            'unit_price' => 120.50,
            'total_price' => 241.00,
        ]);

        $this->actingAs($admin)->get(OrderResource::getUrl('index'))->assertSuccessful();
        $this->actingAs($admin)->get(OrderResource::getUrl('edit', ['record' => $order]))->assertSuccessful();

        $this->assertFalse(OrderResource::canCreate());
    }
}
