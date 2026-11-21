<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The client_id column was created with BE-003 (docs/AUTH_CONTRACT.md);
     * its foreign key lands here with the Client module (BE-004).
     */
    public function up(): void
    {
        Schema::table('client_accounts', function (Blueprint $table) {
            $table->foreign('client_id')->references('id')->on('clients')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('client_accounts', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
        });
    }
};
