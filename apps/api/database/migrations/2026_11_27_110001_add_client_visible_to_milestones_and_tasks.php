<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Group 7 selective visibility (docs/PORTAL_CONTRACT.md section
        // 2.1, DEC-028 Q1): the agency picks per milestone/task what
        // the client sees in the Portal. Default TRUE preserves the
        // current behaviour (the Portal used to show everything); the
        // Portal progress percent is computed over visible tasks only.
        Schema::table('milestones', function (Blueprint $table) {
            $table->boolean('client_visible')->default(true);
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('client_visible')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('milestones', function (Blueprint $table) {
            $table->dropColumn('client_visible');
        });

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('client_visible');
        });
    }
};
