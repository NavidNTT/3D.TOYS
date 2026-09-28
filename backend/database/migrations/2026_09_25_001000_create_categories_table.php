<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Categories were the missing half of the catalog: the storefront renders
     * per-category theming (buttons, badges, glows) from `theme_config`, and
     * products reference a category. The table is created here because the
     * checkout schema needs `products.category_id` to be a real foreign key.
     */
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();

            // Free-form palette consumed by the frontend: primary_color,
            // glow_color, accent_color, background_color.
            $table->json('theme_config')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
