<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * DEC-014 / docs/CRM_CONTRACT.md section 2: the contacts table is shared
     * between clients and leads. A contact belongs to exactly one owner
     * (lead XOR client), so client_id becomes nullable and lead_id is added.
     */
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->foreignId('lead_id')->nullable()->after('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->nullable()->change();

            $table->index(['agency_id', 'lead_id']);
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropIndex(['agency_id', 'lead_id']);
            $table->dropConstrainedForeignId('lead_id');
            $table->foreignId('client_id')->nullable(false)->change();
        });
    }
};
