<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BE-009 (DEC-018): the "active agency" of a session lives in the
 * token record itself (design section 3.1). A full token is bound to
 * exactly one membership (and through it, one agency); selection
 * tokens have both columns NULL and may only call select/switch.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->after('tokenable_id')
                ->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('membership_id')->nullable()->after('agency_id')
                ->constrained('memberships')->cascadeOnDelete();
            $table->index(['membership_id']);
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('membership_id');
            $table->dropConstrainedForeignId('agency_id');
        });
    }
};
