<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * `price` and `stock` are the columns checkout depends on: the order total
     * is computed from this row (never from the request) and `stock` is
     * decremented inside the same transaction that creates the order.
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();

            // Exact decimals, never floats: this is the number the customer
            // is charged.
            $table->decimal('price', 12, 2);
            $table->decimal('compare_at_price', 12, 2)->nullable();
            $table->string('currency', 3)->default('USD');

            $table->unsignedInteger('stock')->default(0);
            $table->boolean('is_active')->default(true);

            // Dynamic toy attributes ({"Material": "Tin", ...}) rendered as the
            // specification list on the product page.
            $table->json('attributes')->nullable();

            $table->timestamps();

            // Storefront listings filter on active products by category.
            $table->index(['is_active', 'category_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
