<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->date('due_date')->nullable();
            // Enum keys only: planned | in_progress | completed.
            $table->string('status')->default('planned');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('milestones');
    }
};
