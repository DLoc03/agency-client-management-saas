<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BE-010 (DEC-020): invitations gain a kind. `staff` invitations are
 * the original member invites; `client` invitations carry the client
 * record the invitee gets Portal access to when they set their own
 * password through the link (replacing the DEC-009.6 flow where the
 * agency set the Portal password). Plain columns only — no generated
 * columns involved, so this is safe on MySQL (PR #57 lesson).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->string('kind', 16)->default('staff')->after('user_id');
            $table->foreignId('client_id')->nullable()->after('kind')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('invitations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('client_id');
            $table->dropColumn('kind');
        });
    }
};
