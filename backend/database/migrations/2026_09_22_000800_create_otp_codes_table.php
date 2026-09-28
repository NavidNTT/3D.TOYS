<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * OTP codes are stored hashed (bcrypt) exactly like passwords would be:
     * a leaked database or a stray dump query must never reveal a usable code.
     */
    public function up(): void
    {
        Schema::create('otp_codes', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 11)->index();
            $table->string('code');                    // Hash::make() output, never plaintext
            $table->timestamp('expires_at')->index();  // 2 minute window by default
            $table->timestamp('created_at')->useCurrent();

            // Lookups are always "latest active code for this phone".
            $table->index(['phone', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('otp_codes');
    }
};
