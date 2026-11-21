<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('company_name')->nullable();
            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            // Enum keys only (docs/RBAC_AND_I18N.md):
            // website | referral | social | cold_outreach | other.
            $table->string('source')->default('other');
            // Enum keys only: new | contacted | qualified | unqualified.
            // The statuses double as the (simple) sales pipeline stages.
            $table->string('status')->default('new');
            $table->decimal('estimated_value', 15, 2)->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('unqualified_reason')->nullable();
            $table->foreignId('converted_client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->timestamp('converted_at')->nullable();
            $table->timestamp('last_contacted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['agency_id', 'status']);
            $table->index(['agency_id', 'owner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
