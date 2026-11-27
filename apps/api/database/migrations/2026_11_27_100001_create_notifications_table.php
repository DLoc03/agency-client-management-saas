<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Custom notification store (docs/WORKFLOW_CONTRACT.md section
        // 2, DEC-026): Laravel's built-in database-notifications table
        // is deliberately NOT used, so notifications follow the same
        // BelongsToAgency tenancy style as every other module.
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            // Event key only (task.assigned, reminder.task_due, ...) —
            // display text is rendered by the client from `data`.
            $table->string('type');
            $table->json('data')->nullable();
            // Reminder idempotency: at most one reminder per entity,
            // recipient and agency-local day (contract section 6).
            $table->string('dedupe_key')->nullable()->unique();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->index(['agency_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
