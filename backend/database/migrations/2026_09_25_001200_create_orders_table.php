<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * `total_amount` is the authoritative charge, recomputed server-side from
     * the locked product rows — the client never sends a price.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Human-quotable tracking number shown on the confirmation page.
            $table->string('order_number', 32)->unique();

            $table->decimal('total_amount', 14, 2);

            // Mirrors App\Enums\OrderStatus; new states arrive with a migration,
            // the enum is the single source of truth in PHP.
            $table->enum('status', ['pending', 'paid', 'processing', 'completed', 'cancelled'])
                ->default('pending');

            // Shipping details are copied onto the order rather than referenced
            // to an address book: an order is a historical record and must not
            // change when the customer edits their profile.
            $table->string('receiver_name');
            $table->string('receiver_phone', 11);
            $table->string('province', 100);
            $table->string('city', 100);
            $table->text('address');
            $table->string('postal_code', 10);
            $table->text('notes')->nullable();

            $table->timestamps();

            // "My orders" lists by user, newest first, often filtered by status.
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
