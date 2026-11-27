<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * BE-009 (docs/WORKFLOW_CONTRACT.md section 4, DEC-026): the
     * notification recipient rules name the task creator and the
     * invoice creator, but neither table recorded its creator. This
     * additive, nullable column closes that gap; rows created before
     * this migration keep NULL and simply have no creator recipient.
     */
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
