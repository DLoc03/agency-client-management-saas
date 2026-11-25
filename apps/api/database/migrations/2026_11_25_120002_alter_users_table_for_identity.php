<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BE-009 (DEC-018): `users` becomes the pure identity table — the
 * agency link and the per-agency profile fields move to `memberships`.
 * `last_membership_id` remembers the most recent workspace so the next
 * login can go straight back to it (design Q5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agency_id');
            $table->dropColumn(['job_title', 'phone']);
            $table->foreignId('last_membership_id')->nullable()->after('last_login_at')
                ->constrained('memberships')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('last_membership_id');
            $table->string('job_title')->nullable();
            $table->string('phone')->nullable();
            $table->foreignId('agency_id')->nullable()->constrained('agencies')->cascadeOnDelete();
        });
    }
};
