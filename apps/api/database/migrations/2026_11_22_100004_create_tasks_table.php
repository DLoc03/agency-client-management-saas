<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('milestone_id')->nullable()->constrained('milestones')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            // Enum keys only: todo | in_progress | in_review | done.
            $table->string('status')->default('todo');
            // Enum keys only: low | medium | high | urgent.
            $table->string('priority')->default('medium');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('due_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('position')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'project_id', 'status']);
            $table->index(['agency_id', 'assignee_id', 'status']);
            $table->index(['agency_id', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
