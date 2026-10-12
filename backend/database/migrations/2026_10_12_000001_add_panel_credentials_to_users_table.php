<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Panel credentials for administrators.
 *
 * The storefront is passwordless by design: `phone` is the customer identity and
 * access comes from a Sanctum token issued after an OTP challenge (see
 * `otp_codes`). The `/admin` panel, however, is a Filament panel whose login page
 * authenticates an `email` + `password` pair — and neither column existed, so
 * `Auth::attempt(['email' => …, 'password' => …])` failed with
 * `Unknown column 'email' in 'where clause'` and **no one could enter the panel at
 * all**.
 *
 * This migration adds exactly the three columns that panel login needs, all
 * nullable, so nothing about the existing customer flow changes:
 *
 *  - `email`    — the panel's username field (unique, null for every customer);
 *  - `password` — hashed by the model's `hashed` cast; null until an operator
 *                 sets one, and never consulted by OTP authentication;
 *  - `remember_token` — required by the session guard when the panel's
 *                 "remember me" box is ticked.
 *
 * It is additive and reversible: `down()` drops the three columns and takes
 * nothing else with it. `phone` remains the identity for every storefront path,
 * and the 14 existing rows keep their `phone`/`name`/`role` values untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // Nullable + unique: MySQL permits any number of NULLs in a unique
            // index, so every customer row keeps `email` null while the seeded
            // administrator gets the one address the panel logs in with.
            $table->string('email')->nullable()->unique();
            $table->string('password')->nullable();
            $table->rememberToken();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            // The index is dropped before the column it belongs to; MySQL will
            // not drop a column out from under its own unique index.
            $table->dropUnique(['email']);
            $table->dropColumn(['email', 'password', 'remember_token']);
        });
    }
};
