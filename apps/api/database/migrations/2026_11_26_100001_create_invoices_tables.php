<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            // Auto-generated per agency at creation, immutable afterwards
            // (docs/FINANCE_CONTRACT.md section 4.1): INV-{YYYY}-{seq}.
            $table->string('number');
            // Stored status keys only: draft | sent | paid | cancelled.
            // "overdue" is derived at read time (contract section 4.3).
            $table->string('status')->default('draft');
            $table->date('issue_date');
            $table->date('due_date')->nullable();
            $table->decimal('tax_rate', 5, 2)->nullable();
            // Totals are stored at create/update time (contract 4.2),
            // never recomputed at read.
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['agency_id', 'number']);
            $table->index(['agency_id', 'status']);
            $table->index(['agency_id', 'client_id']);
            $table->index(['agency_id', 'project_id']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->string('description');
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_price', 15, 2);
            // Stored: quantity x unit_price, rounded at write (contract 4.2).
            $table->decimal('amount', 15, 2);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['invoice_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
    }
};
