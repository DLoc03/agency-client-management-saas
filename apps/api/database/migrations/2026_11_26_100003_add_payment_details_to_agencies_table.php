<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            // Static bank-transfer / VietQR details shown on invoices and
            // PDFs (docs/FINANCE_CONTRACT.md section 2). All nullable: an
            // agency that never fills them simply shows no payment block.
            $table->string('bank_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('bank_account_holder')->nullable();
            $table->text('vietqr_payload')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropColumn(['bank_name', 'bank_account_number', 'bank_account_holder', 'vietqr_payload']);
        });
    }
};
