<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('media3d', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('original_file_url')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->string('lighting_preset')->default('studio');
            $table->json('camera_settings')->nullable();
            $table->boolean('auto_rotate')->default(true);
            $table->decimal('rotation_speed', 5, 2)->default(1.00);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('media3d');
    }
};

