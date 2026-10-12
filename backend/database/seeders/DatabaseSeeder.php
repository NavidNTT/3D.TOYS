<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     *
     * Fixed phone numbers so you can log in immediately in development:
     * request an OTP for 09120000000 / 09121111111 and read the code from
     * storage/logs/laravel.log (the log SMS driver).
     *
     * The administrator also gets panel credentials, because `/admin` is a
     * Filament panel and its login page authenticates an email + password pair
     * (`admin@toy-store.local` / `password` in development; see
     * docs/p6-admin-and-irt-pricing.md). The customer gets no email and no
     * password — the storefront stays phone + OTP only.
     *
     * The catalog is seeded too, otherwise the storefront has nothing to render
     * and every list endpoint answers with an empty collection.
     */
    public function run(): void
    {
        User::factory()->admin()->create([
            'name' => 'مدیر فروشگاه',
            'phone' => '09120000000',
        ]);

        User::factory()->create([
            'name' => 'مشتری نمونه',
            'phone' => '09121111111',
            'role' => UserRole::Customer,
        ]);

        $this->call(CatalogSeeder::class);
    }
}
