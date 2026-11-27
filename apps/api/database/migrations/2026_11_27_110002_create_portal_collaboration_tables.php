<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Group 7 (docs/PORTAL_CONTRACT.md, DEC-028): file sharing,
        // the per-project Portal discussion thread and approval
        // requests. All three tables follow the BelongsToAgency style
        // of every other module.
        Schema::create('project_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            // The identity that uploaded the file (staff or client).
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->string('uploader_kind');
            $table->string('original_name');
            // Path on the private `local` disk. Never exposed in API
            // responses — downloads stream through an authorized
            // endpoint (contract section 2.2).
            $table->string('stored_path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes');
            // Only meaningful for staff uploads (default true); client
            // uploads are always visible to the agency.
            $table->boolean('client_visible')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'project_id']);
        });

        // A table of its own, deliberately separate from the internal
        // task_comments (which must never leak to the Portal): the
        // exposure boundary lives in the data layer (contract 2.3).
        Schema::create('portal_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('author_kind');
            $table->text('body');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'project_id']);
        });

        Schema::create('approval_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('file_id')->nullable()->constrained('project_files')->nullOnDelete();
            $table->foreignId('milestone_id')->nullable()->constrained('milestones')->nullOnDelete();
            // Nullable in storage: the FormRequest requires a title
            // unless the request points at a file or a milestone, in
            // which case the controller defaults it from that target.
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('pending');
            $table->text('response_comment')->nullable();
            $table->foreignId('responded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'project_id']);
            $table->index(['project_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_requests');
        Schema::dropIfExists('portal_comments');
        Schema::dropIfExists('project_files');
    }
};
