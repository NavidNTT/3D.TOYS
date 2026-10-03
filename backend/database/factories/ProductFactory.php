<?php

namespace Database\Factories;

use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            // No category by default: the relation is optional, so tests that
            // do not care about theming never need a categories row.
            'category_id' => null,
            'title' => ucwords(fake()->words(3, true)),
            'slug' => fake()->unique()->slug(3),
            'description' => fake()->sentence(),
            // Integer Toman: the column stores whole Toman, and checkout has to
            // reproduce this number exactly. Prices look like a real toy
            // (۵۰٬۰۰۰ – ۵٬۰۰۰٬۰۰۰ تومان), not like a US catalogue.
            'price' => fake()->numberBetween(50_000, 5_000_000),
            'compare_at_price' => null,
            'currency' => 'IRT',
            'stock' => fake()->numberBetween(1, 50),
            'is_active' => true,
            'attributes' => ['Material' => 'ABS'],
        ];
    }

    /**
     * A product with nothing left on the shelf.
     */
    public function outOfStock(): static
    {
        return $this->state(fn (array $attributes) => [
            'stock' => 0,
        ]);
    }

    /**
     * An unpublished product: still in the catalog, not for sale.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * A fixed price in Toman, so assertions can be exact integers.
     */
    public function pricedAt(int $price): static
    {
        return $this->state(fn (array $attributes) => [
            'price' => $price,
        ]);
    }
}
