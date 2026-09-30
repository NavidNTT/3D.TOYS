<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add Draco optimization result columns to the 3D media table.
     */
    public function up(): void
    {
        Schema::table('media3d', function (Blueprint $table) {
            $table->string('optimized_file_url')->nullable()->after('original_file_url');
            $table->unsignedBigInteger('file_size')->nullable()->after('optimized_file_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('media3d', function (Blueprint $table) {
            $table->dropColumn(['optimized_file_url', 'file_size']);
        });
    }
};
