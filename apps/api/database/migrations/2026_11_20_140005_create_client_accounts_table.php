<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            // FK to `clients` is added by the Client module migration (BE-004);
            // the column exists now so portal accounts can be linked later.
            $table->unsignedBigInteger('client_id')->nullable()->index();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('locale', 5)->default('en');
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_accounts');
    }
};
