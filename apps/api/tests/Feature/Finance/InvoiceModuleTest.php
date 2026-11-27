<?php

namespace Tests\Feature\Finance;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-008 Finance & Billing — invoices (docs/FINANCE_CONTRACT.md,
 * DEC-019): CRUD, invoice numbers, money/tax, status lifecycle,
 * RBAC matrix, agency payment details, project reconciliation.
 */
class InvoiceModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function makeUser(array $roles = [Role::OWNER], ?int $agencyId = null): User
    {
        return $this->makeMembershipUser($roles, $agencyId);
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    private function makeClient(User $owner, array $attrs = []): Client
    {
        return Client::factory()->create(array_merge(['agency_id' => $owner->agency_id], $attrs));
    }

    /**
     * An invoice built directly (bypassing the API) with items whose
     * stored totals are computed the same way the API computes them.
     */
    private function makeInvoice(User $owner, array $attrs = [], array $items = [[1000, 1]]): Invoice
    {
        $invoice = Invoice::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $this->makeClient($owner)->id,
        ], $attrs));

        $subtotal = 0;
        foreach (array_values($items) as $i => [$unitPrice, $quantity]) {
            $amount = round($unitPrice * $quantity, 2);
            $subtotal += $amount;
            $invoice->items()->create([
                'description' => 'Item '.($i + 1),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'amount' => $amount,
                'sort_order' => $i,
            ]);
        }
        $taxAmount = $invoice->tax_rate === null ? 0.0 : round($subtotal * (float) $invoice->tax_rate / 100, 2);
        $invoice->forceFill([
            'subtotal' => $subtotal,
            'tax_amount' => $taxAmount,
            'total' => round($subtotal + $taxAmount, 2),
        ])->save();

        return $invoice->refresh();
    }

    public function test_owner_creates_invoice_with_items_and_totals_are_computed(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $year = now()->format('Y');

        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $client->id,
            'tax_rate' => 10,
            'items' => [
                ['description' => 'Design', 'quantity' => 2, 'unit_price' => 500],
                ['description' => 'Hosting setup', 'quantity' => 1.5, 'unit_price' => 200],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('data.number', "INV-{$year}-0001")
            ->assertJsonPath('data.status', Invoice::STATUS_DRAFT)
            ->assertJsonPath('data.stored_status', Invoice::STATUS_DRAFT)
            ->assertJsonPath('data.subtotal', '1300.00')
            ->assertJsonPath('data.tax_amount', '130.00')
            ->assertJsonPath('data.total', '1430.00')
            ->assertJsonPath('data.paid_total', '0.00')
            ->assertJsonPath('data.balance_due', '1430.00')
            ->assertJsonPath('data.client.id', $client->id)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.amount', '1000.00')
            ->assertJsonPath('data.items.1.amount', '300.00');
    }

    public function test_invoice_numbers_increment_per_agency_and_are_never_reused(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $year = now()->format('Y');
        $payload = ['client_id' => $client->id, 'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]]];

        $first = $this->as($owner)->postJson('/api/v1/invoices', $payload)->assertCreated()->json('data');
        $second = $this->as($owner)->postJson('/api/v1/invoices', $payload)->assertCreated()->json('data');
        $this->assertSame("INV-{$year}-0001", $first['number']);
        $this->assertSame("INV-{$year}-0002", $second['number']);

        // Deleting the first draft must not free its number.
        $this->as($owner)->deleteJson("/api/v1/invoices/{$first['id']}")->assertNoContent();
        $third = $this->as($owner)->postJson('/api/v1/invoices', $payload)->assertCreated()->json('data');
        $this->assertSame("INV-{$year}-0003", $third['number']);

        // Another agency starts its own sequence.
        $other = $this->makeUser();
        $otherClient = $this->makeClient($other);
        $foreign = $this->as($other)->postJson('/api/v1/invoices', [
            'client_id' => $otherClient->id,
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]],
        ])->assertCreated()->json('data');
        $this->assertSame("INV-{$year}-0001", $foreign['number']);
    }

    public function test_create_with_null_tax_has_zero_tax_amount(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);

        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $client->id,
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 250]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.tax_rate', null)
            ->assertJsonPath('data.tax_amount', '0.00')
            ->assertJsonPath('data.total', '250.00');
    }

    public function test_create_with_cross_tenant_references_returns_422(): void
    {
        $owner = $this->makeUser();
        $foreignOwner = $this->makeUser();
        $foreignClient = $this->makeClient($foreignOwner);
        $foreignProject = Project::factory()->create([
            'agency_id' => $foreignOwner->agency_id,
            'client_id' => $foreignClient->id,
        ]);
        $ownClient = $this->makeClient($owner);

        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $foreignClient->id,
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]],
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $ownClient->id,
            'project_id' => $foreignProject->id,
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]],
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => 999999,
            'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]],
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['details' => ['client_id']]]);
    }

    public function test_invoice_of_another_agency_returns_404_everywhere(): void
    {
        $owner = $this->makeUser();
        $foreignOwner = $this->makeUser();
        $foreign = $this->makeInvoice($foreignOwner, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);

        $this->as($owner)->getJson("/api/v1/invoices/{$foreign->id}")->assertNotFound();
        $this->as($owner)->patchJson("/api/v1/invoices/{$foreign->id}", ['notes' => 'x'])->assertNotFound();
        $this->as($owner)->deleteJson("/api/v1/invoices/{$foreign->id}")->assertNotFound();
        $this->as($owner)->postJson("/api/v1/invoices/{$foreign->id}/send")->assertNotFound();
        $this->as($owner)->postJson("/api/v1/invoices/{$foreign->id}/cancel")->assertNotFound();
        $this->as($owner)->getJson("/api/v1/invoices/{$foreign->id}/pdf")->assertNotFound();
        $this->as($owner)->getJson("/api/v1/invoices/{$foreign->id}/payments")->assertNotFound();
        $this->as($owner)->postJson("/api/v1/invoices/{$foreign->id}/payments", [
            'amount' => 1, 'method' => 'cash',
        ])->assertNotFound();
    }

    public function test_update_draft_replaces_items_and_recomputes_totals(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeInvoice($owner, ['tax_rate' => 10], [[100, 1]]);

        $this->as($owner)->patchJson("/api/v1/invoices/{$invoice->id}", [
            'items' => [['description' => 'New scope', 'quantity' => 3, 'unit_price' => 200]],
        ])
            ->assertOk()
            ->assertJsonPath('data.subtotal', '600.00')
            ->assertJsonPath('data.tax_amount', '60.00')
            ->assertJsonPath('data.total', '660.00')
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.description', 'New scope');

        // A PATCH without items keeps the existing lines.
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoice->id}", ['notes' => 'Net 30'])
            ->assertOk()
            ->assertJsonPath('data.notes', 'Net 30')
            ->assertJsonCount(1, 'data.items');
    }

    public function test_update_sent_invoice_is_rejected(): void
    {
        $owner = $this->makeUser();
        $invoice = $this->makeInvoice($owner, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);

        $this->as($owner)->patchJson("/api/v1/invoices/{$invoice->id}", ['notes' => 'x'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVOICE_NOT_EDITABLE');
    }

    public function test_send_requires_items_and_stamps_sent_at(): void
    {
        $owner = $this->makeUser();
        $empty = $this->makeInvoice($owner, [], []);
        // makeInvoice with no items leaves a draft with zero lines.
        $this->as($owner)->postJson("/api/v1/invoices/{$empty->id}/send")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVOICE_EMPTY');

        $invoice = $this->makeInvoice($owner);
        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/send")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_SENT)
            ->assertJsonPath('data.stored_status', Invoice::STATUS_SENT)
            ->assertJson(fn ($json) => $json->whereType('data.sent_at', 'string')->etc());

        // Sending twice is a state violation.
        $this->as($owner)->postJson("/api/v1/invoices/{$invoice->id}/send")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVOICE_NOT_EDITABLE');
    }

    public function test_overdue_is_derived_at_read_and_filterable(): void
    {
        $owner = $this->makeUser();
        $overdue = $this->makeInvoice($owner, [
            'status' => Invoice::STATUS_SENT, 'sent_at' => now()->subDays(20),
            'due_date' => now()->subDay()->toDateString(),
        ]);
        $current = $this->makeInvoice($owner, [
            'status' => Invoice::STATUS_SENT, 'sent_at' => now(),
            'due_date' => now()->addDays(5)->toDateString(),
        ]);
        $dueToday = $this->makeInvoice($owner, [
            'status' => Invoice::STATUS_SENT, 'sent_at' => now(),
            'due_date' => now()->toDateString(),
        ]);

        $this->as($owner)->getJson("/api/v1/invoices/{$overdue->id}")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_OVERDUE)
            ->assertJsonPath('data.stored_status', Invoice::STATUS_SENT);

        $this->as($owner)->getJson("/api/v1/invoices/{$current->id}")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_SENT);

        $this->as($owner)->getJson("/api/v1/invoices/{$dueToday->id}")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_SENT);

        $ids = collect($this->as($owner)->getJson('/api/v1/invoices?status=overdue')->assertOk()->json('data'))
            ->pluck('id');
        $this->assertTrue($ids->contains($overdue->id));
        $this->assertFalse($ids->contains($current->id));

        $paidIds = collect($this->as($owner)->getJson('/api/v1/invoices?status=paid')->assertOk()->json('data'))
            ->pluck('id');
        $this->assertFalse($paidIds->contains($overdue->id));
    }

    public function test_cancel_rules(): void
    {
        $owner = $this->makeUser();

        $sent = $this->makeInvoice($owner, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);
        $this->as($owner)->postJson("/api/v1/invoices/{$sent->id}/cancel")
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_CANCELLED);

        $draft = $this->makeInvoice($owner);
        $this->as($owner)->postJson("/api/v1/invoices/{$draft->id}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CANNOT_CANCEL_INVOICE');

        $paid = $this->makeInvoice($owner, ['status' => Invoice::STATUS_PAID, 'sent_at' => now(), 'paid_at' => now()]);
        $this->as($owner)->postJson("/api/v1/invoices/{$paid->id}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CANNOT_CANCEL_INVOICE');
    }

    public function test_delete_rules(): void
    {
        $owner = $this->makeUser();
        $admin = $this->makeUser([Role::ADMIN], $owner->agency_id);

        $draft = $this->makeInvoice($owner);
        // invoices.delete is Owner-only: even an Admin gets a 403.
        $this->as($admin)->deleteJson("/api/v1/invoices/{$draft->id}")->assertForbidden();

        $this->as($owner)->deleteJson("/api/v1/invoices/{$draft->id}")->assertNoContent();
        $this->as($owner)->getJson("/api/v1/invoices/{$draft->id}")->assertNotFound();

        $sent = $this->makeInvoice($owner, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);
        $this->as($owner)->deleteJson("/api/v1/invoices/{$sent->id}")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'CANNOT_DELETE_INVOICE');
    }

    public function test_finance_permission_matrix(): void
    {
        $owner = $this->makeUser();
        $agencyId = $owner->agency_id;
        $sales = $this->makeUser([Role::SALES_MANAGER], $agencyId);
        $pm = $this->makeUser([Role::PROJECT_MANAGER], $agencyId);
        $accountant = $this->makeUser([Role::ACCOUNTANT], $agencyId);
        $member = $this->makeUser([Role::TEAM_MEMBER], $agencyId);
        $client = $this->makeClient($owner);
        $invoice = $this->makeInvoice($owner);
        $payload = ['client_id' => $client->id, 'items' => [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]]];

        // View: everyone except Team Member.
        foreach ([$sales, $pm, $accountant] as $viewer) {
            $this->as($viewer)->getJson('/api/v1/invoices')->assertOk();
            $this->as($viewer)->getJson("/api/v1/invoices/{$invoice->id}")->assertOk();
        }
        $this->as($member)->getJson('/api/v1/invoices')->assertForbidden();
        $this->as($member)->getJson("/api/v1/invoices/{$invoice->id}")->assertForbidden();

        // Create: Sales / PM / Team Member may not; Accountant may.
        $this->as($sales)->postJson('/api/v1/invoices', $payload)->assertForbidden();
        $this->as($pm)->postJson('/api/v1/invoices', $payload)->assertForbidden();
        $this->as($member)->postJson('/api/v1/invoices', $payload)->assertForbidden();
        $created = $this->as($accountant)->postJson('/api/v1/invoices', $payload)->assertCreated()->json('data');

        // Send: Accountant may.
        $this->as($accountant)->postJson("/api/v1/invoices/{$created['id']}/send")->assertOk();
        $this->as($sales)->postJson("/api/v1/invoices/{$invoice->id}/send")->assertForbidden();
    }

    public function test_list_filters_and_search(): void
    {
        $owner = $this->makeUser();
        $clientA = $this->makeClient($owner, ['name' => 'Alpha Studio']);
        $clientB = $this->makeClient($owner, ['name' => 'Beta Labs']);
        $project = Project::factory()->create(['agency_id' => $owner->agency_id, 'client_id' => $clientA->id]);

        $a = $this->makeInvoice($owner, ['client_id' => $clientA->id, 'project_id' => $project->id]);
        $b = $this->makeInvoice($owner, ['client_id' => $clientB->id]);

        $byClient = collect($this->as($owner)->getJson("/api/v1/invoices?client_id={$clientA->id}")->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($byClient->contains($a->id));
        $this->assertFalse($byClient->contains($b->id));

        $byProject = collect($this->as($owner)->getJson("/api/v1/invoices?project_id={$project->id}")->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($byProject->contains($a->id));
        $this->assertFalse($byProject->contains($b->id));

        $byNumber = collect($this->as($owner)->getJson("/api/v1/invoices?q={$a->number}")->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($byNumber->contains($a->id));
        $this->assertFalse($byNumber->contains($b->id));

        $byClientName = collect($this->as($owner)->getJson('/api/v1/invoices?q=Beta')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($byClientName->contains($b->id));
        $this->assertFalse($byClientName->contains($a->id));
    }

    public function test_pdf_export(): void
    {
        $owner = $this->makeUser();
        $member = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $invoice = $this->makeInvoice($owner);

        $response = $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}/pdf");
        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type'));
        $this->assertStringContainsString($invoice->number.'.pdf', $response->headers->get('content-disposition'));
        $this->assertStringStartsWith('%PDF', $response->getContent());

        $this->as($member)->getJson("/api/v1/invoices/{$invoice->id}/pdf")->assertForbidden();
    }

    public function test_agency_payment_details_update_and_visibility(): void
    {
        $owner = $this->makeUser();
        $agencyId = $owner->agency_id;
        $admin = $this->makeUser([Role::ADMIN], $agencyId);
        $accountant = $this->makeUser([Role::ACCOUNTANT], $agencyId);
        $otherAgency = $this->makeUser();

        $this->as($owner)->patchJson("/api/v1/agencies/{$agencyId}/payment-details", [
            'bank_name' => 'Vietcombank',
            'bank_account_number' => '1234567890',
            'bank_account_holder' => 'Demo Agency',
            'vietqr_payload' => 'qr-static-payload',
        ])
            ->assertOk()
            ->assertJsonPath('data.bank_name', 'Vietcombank')
            ->assertJsonPath('data.bank_account_number', '1234567890');

        // Shown on the invoice detail.
        $invoice = $this->makeInvoice($owner);
        $this->as($owner)->getJson("/api/v1/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.payment_details.bank_name', 'Vietcombank')
            ->assertJsonPath('data.payment_details.vietqr_payload', 'qr-static-payload');

        // Admin may edit too; Accountant may not.
        $this->as($admin)->patchJson("/api/v1/agencies/{$agencyId}/payment-details", ['bank_name' => 'ACB'])
            ->assertOk()
            ->assertJsonPath('data.bank_name', 'ACB');
        $this->as($accountant)->patchJson("/api/v1/agencies/{$agencyId}/payment-details", ['bank_name' => 'X'])
            ->assertForbidden();

        // Another agency's id is a 404, never a write into foreign data.
        $this->as($owner)->patchJson("/api/v1/agencies/{$otherAgency->agency_id}/payment-details", ['bank_name' => 'X'])
            ->assertNotFound();
    }

    public function test_agency_payment_details_get_returns_saved_and_empty_fields(): void
    {
        $owner = $this->makeUser();
        $agencyId = $owner->agency_id;
        $sales = $this->makeUser([Role::SALES_MANAGER], $agencyId);
        $otherAgency = $this->makeUser();

        // Fresh agency: the four fields read back as null.
        $this->as($owner)->getJson("/api/v1/agencies/{$agencyId}/payment-details")
            ->assertOk()
            ->assertJsonPath('data.id', $agencyId)
            ->assertJsonPath('data.bank_name', null)
            ->assertJsonPath('data.vietqr_payload', null);

        // After a PATCH, GET returns the same shape with the saved values.
        $this->as($owner)->patchJson("/api/v1/agencies/{$agencyId}/payment-details", [
            'bank_name' => 'Vietcombank',
            'bank_account_number' => '1234567890',
            'bank_account_holder' => 'Demo Agency',
            'vietqr_payload' => 'qr-static-payload',
        ])->assertOk();

        $this->as($owner)->getJson("/api/v1/agencies/{$agencyId}/payment-details")
            ->assertOk()
            ->assertJsonPath('data.bank_name', 'Vietcombank')
            ->assertJsonPath('data.bank_account_number', '1234567890')
            ->assertJsonPath('data.bank_account_holder', 'Demo Agency')
            ->assertJsonPath('data.vietqr_payload', 'qr-static-payload');

        // Same authorization as PATCH: Sales Manager may not read it...
        $this->as($sales)->getJson("/api/v1/agencies/{$agencyId}/payment-details")->assertForbidden();

        // ...and another agency's id is a 404, never foreign data.
        $this->as($owner)->getJson("/api/v1/agencies/{$otherAgency->agency_id}/payment-details")->assertNotFound();
    }

    public function test_invoice_project_must_belong_to_the_same_client(): void
    {
        $owner = $this->makeUser();
        $clientA = $this->makeClient($owner);
        $clientB = $this->makeClient($owner);
        $projectA = Project::factory()->create(['agency_id' => $owner->agency_id, 'client_id' => $clientA->id]);
        $projectB = Project::factory()->create(['agency_id' => $owner->agency_id, 'client_id' => $clientB->id]);
        $otherAgency = $this->makeUser();
        $foreignProject = Project::factory()->create([
            'agency_id' => $otherAgency->agency_id,
            'client_id' => $this->makeClient($otherAgency)->id,
        ]);

        $items = [['description' => 'X', 'quantity' => 1, 'unit_price' => 10]];

        // Create: a project of another client in the same agency is rejected.
        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $clientA->id,
            'project_id' => $projectB->id,
            'items' => $items,
        ])->assertStatus(422)->assertJsonPath('error.code', 'PROJECT_CLIENT_MISMATCH');

        // Create with the project's own client, or with no project, is fine.
        $invoiceId = $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $clientA->id,
            'project_id' => $projectA->id,
            'items' => $items,
        ])->assertCreated()->json('data.id');
        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $clientA->id,
            'items' => $items,
        ])->assertCreated();

        // Update: switching only the project to another client's project
        // is rejected — the invoice's stored client applies.
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoiceId}", [
            'project_id' => $projectB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'PROJECT_CLIENT_MISMATCH');

        // Update with the same client's project, or clearing the project, is fine.
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoiceId}", [
            'project_id' => $projectA->id,
        ])->assertOk();
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoiceId}", [
            'project_id' => null,
        ])->assertOk();

        // Update that moves the client while the project stays put is
        // judged against the NEW client.
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoiceId}", [
            'project_id' => $projectA->id,
        ])->assertOk();
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoiceId}", [
            'client_id' => $clientB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'PROJECT_CLIENT_MISMATCH');

        // A project from another agency still answers CROSS_TENANT_REFERENCE.
        $this->as($owner)->postJson('/api/v1/invoices', [
            'client_id' => $clientA->id,
            'project_id' => $foreignProject->id,
            'items' => $items,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
        $this->as($owner)->patchJson("/api/v1/invoices/{$invoiceId}", [
            'project_id' => $foreignProject->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_project_reconciliation_figures(): void
    {
        $owner = $this->makeUser();
        $client = $this->makeClient($owner);
        $project = Project::factory()->create([
            'agency_id' => $owner->agency_id,
            'client_id' => $client->id,
            'budget' => 10000,
        ]);

        $this->makeInvoice($owner, ['client_id' => $client->id, 'project_id' => $project->id], [[1000, 1]]);
        $sent = $this->makeInvoice($owner, [
            'client_id' => $client->id, 'project_id' => $project->id,
            'status' => Invoice::STATUS_SENT, 'sent_at' => now(),
        ], [[2000, 1]]);
        $this->makeInvoice($owner, [
            'client_id' => $client->id, 'project_id' => $project->id,
            'status' => Invoice::STATUS_CANCELLED,
        ], [[4000, 1]]);
        // An invoice of another project must not leak into the figures.
        $this->makeInvoice($owner, ['client_id' => $client->id], [[9000, 1]]);

        // Collect 500 against the sent invoice through the API.
        $this->as($owner)->postJson("/api/v1/invoices/{$sent->id}/payments", [
            'amount' => 500, 'method' => 'bank_transfer',
        ])->assertCreated();

        $this->as($owner)->getJson("/api/v1/projects/{$project->id}")
            ->assertOk()
            ->assertJsonPath('data.invoiced_total', '3000.00')
            ->assertJsonPath('data.collected_total', '500.00')
            ->assertJsonPath('data.remaining_budget', '7000.00');

        // No budget: remaining_budget is null, figures still present.
        $noBudget = Project::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id, 'budget' => null,
        ]);
        $this->as($owner)->getJson("/api/v1/projects/{$noBudget->id}")
            ->assertOk()
            ->assertJsonPath('data.invoiced_total', '0.00')
            ->assertJsonPath('data.collected_total', '0.00')
            ->assertJsonPath('data.remaining_budget', null);
    }
}
