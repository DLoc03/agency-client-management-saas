<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BE-009 (DEC-018): the membership tables — one identity (users) can
 * belong to many agencies. `memberships` carries the agency link, the
 * kind (staff/client) and the per-agency profile fields; roles attach
 * to memberships via `membership_role` (replacing `role_user`).
 *
 * The table is created with raw SQL because the design requires a
 * CHECK constraint for the kind/client_id rule and a unique index
 * that also covers NULL client_id — via the client_key column
 * (client_id, or 0 when NULL), maintained by the Membership model.
 * client_key is deliberately NOT a generated column: InnoDB refuses
 * a foreign key on a column used by a generated column (error 1215,
 * found by acceptance on MySQL — SQLite accepts it).
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement(<<<'SQL'
                CREATE TABLE memberships (
                    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                    user_id BIGINT UNSIGNED NOT NULL,
                    agency_id BIGINT UNSIGNED NOT NULL,
                    kind ENUM('staff', 'client') NOT NULL DEFAULT 'staff',
                    client_id BIGINT UNSIGNED NULL,
                    client_key BIGINT UNSIGNED NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    job_title VARCHAR(255) NULL,
                    phone VARCHAR(255) NULL,
                    deactivated_at TIMESTAMP NULL,
                    deactivated_by BIGINT UNSIGNED NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL,
                    deleted_at TIMESTAMP NULL,
                    PRIMARY KEY (id),
                    CONSTRAINT memberships_kind_client_check
                        CHECK ((kind = 'staff' AND client_id IS NULL) OR (kind = 'client' AND client_id IS NOT NULL)),
                    UNIQUE KEY memberships_agency_user_kind_client_unique (agency_id, user_id, kind, client_key),
                    KEY memberships_agency_active_index (agency_id, is_active),
                    KEY memberships_user_active_index (user_id, is_active),
                    CONSTRAINT memberships_user_id_foreign FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    CONSTRAINT memberships_agency_id_foreign FOREIGN KEY (agency_id) REFERENCES agencies (id) ON DELETE CASCADE,
                    CONSTRAINT memberships_client_id_foreign FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
                    CONSTRAINT memberships_deactivated_by_foreign FOREIGN KEY (deactivated_by) REFERENCES users (id) ON DELETE SET NULL
                )
            SQL);
        } else {
            DB::statement(<<<'SQL'
                CREATE TABLE memberships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                    agency_id INTEGER NOT NULL REFERENCES agencies (id) ON DELETE CASCADE,
                    kind VARCHAR NOT NULL DEFAULT 'staff',
                    client_id INTEGER NULL REFERENCES clients (id) ON DELETE CASCADE,
                    client_key INTEGER NOT NULL DEFAULT 0,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    job_title VARCHAR(255) NULL,
                    phone VARCHAR(255) NULL,
                    deactivated_at DATETIME NULL,
                    deactivated_by INTEGER NULL REFERENCES users (id) ON DELETE SET NULL,
                    created_at DATETIME NULL,
                    updated_at DATETIME NULL,
                    deleted_at DATETIME NULL,
                    CONSTRAINT memberships_kind_client_check
                        CHECK ((kind = 'staff' AND client_id IS NULL) OR (kind = 'client' AND client_id IS NOT NULL)),
                    CONSTRAINT memberships_kind_check CHECK (kind IN ('staff', 'client')),
                    UNIQUE (agency_id, user_id, kind, client_key)
                )
            SQL);
            DB::statement('CREATE INDEX memberships_agency_active_index ON memberships (agency_id, is_active)');
            DB::statement('CREATE INDEX memberships_user_active_index ON memberships (user_id, is_active)');
        }

        Schema::create('membership_role', function ($table) {
            $table->foreignId('membership_id')->constrained('memberships')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('roles')->cascadeOnDelete();
            $table->unique(['membership_id', 'role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_role');
        Schema::dropIfExists('memberships');
    }
};
