<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * BE-009 (DEC-018): `role_user` is replaced by `membership_role`, and
 * the separate Portal account table `client_accounts` is merged into
 * the single identity (`users`) + client memberships (design option A,
 * approved by the Product Owner). Migration strategy is reset + reseed
 * (design option R), so no data is carried over.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('client_accounts');
    }

    public function down(): void
    {
        // Intentionally not recreated: the old tables' data was dropped
        // under the approved reset strategy; rolling back the schema of
        // BE-009 requires a fresh migrate of the pre-BE-009 codebase.
    }
};
