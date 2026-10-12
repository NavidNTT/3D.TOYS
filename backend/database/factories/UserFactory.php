<?php

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            // 09 + 9 digits, unique so tests never collide on the phone index.
            'phone' => '09'.fake()->unique()->numerify('#########'),
            'role' => UserRole::Customer,
        ];
    }

    /**
     * A user without a name — exactly what OTP registration produces.
     */
    public function unnamed(): static
    {
        return $this->state(fn (array $attributes) => [
            'name' => null,
        ]);
    }

    /**
     * An administrator account.
     *
     * Includes the panel credentials, because an administrator without them
     * cannot reach `/admin` at all: Filament's login page authenticates an
     * email + password pair, and a panel that cannot be entered is not a panel.
     * The password value is a development constant on purpose — it is what the
     * local instructions in docs/p6-admin-and-irt-pricing.md tell an operator to
     * type — and the `hashed` cast stores it as a bcrypt hash.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => UserRole::Admin,
            'email' => 'admin@toy-store.local',
            'password' => 'password',
        ]);
    }
}
