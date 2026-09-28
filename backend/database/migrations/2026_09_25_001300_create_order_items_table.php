<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Prices and titles are snapshotted per line. An order is an invoice: later
     * catalog edits (rename, reprice, retire) must not rewrite history.
     */
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();

            // RESTRICT, not cascade: deleting a product that has been ordered
            // would silently corrupt order history.
            $table->foreignId('product_id')->constrained()->restrictOnDelete();

            $table->string('product_title');
            $table->decimal('unit_price', 12, 2);
            $table->unsignedInteger('quantity');
            $table->decimal('total_price', 14, 2);

            $table->timestamps();

            $table->index('product_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
