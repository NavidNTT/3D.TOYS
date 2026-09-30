<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'name' => ucwords($name),
            'slug' => fake()->unique()->slug(2),
            'description' => fake()->sentence(),
            // A complete palette, because that is what the storefront expects
            // to colour buttons, badges and glows with.
            'theme_config' => [
                'primary_color' => '#38bdf8',
                'glow_color' => '#0ea5e9',
                'accent_color' => '#e0f2fe',
                'background_color' => '#0b1020',
            ],
        ];
    }

    /**
     * A category with no custom palette, so the storefront falls back to its
     * default theme.
     */
    public function withoutTheme(): static
    {
        return $this->state(fn (array $attributes) => [
            'theme_config' => null,
        ]);
    }
}
