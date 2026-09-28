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
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'مدیر فروشگاه',
            'phone' => '09120000000',
            'role' => UserRole::Admin,
        ]);

        User::factory()->create([
            'name' => 'مشتری نمونه',
            'phone' => '09121111111',
            'role' => UserRole::Customer,
        ]);
    }
}
