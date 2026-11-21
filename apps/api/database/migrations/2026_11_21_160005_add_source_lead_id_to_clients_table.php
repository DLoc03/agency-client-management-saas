<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Conversion traceability (docs/CRM_CONTRACT.md section 2): a client
     * created from a lead points back at that lead.
     */
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->foreignId('source_lead_id')->nullable()->after('account_manager_id')
                ->constrained('leads')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_lead_id');
        });
    }
};
