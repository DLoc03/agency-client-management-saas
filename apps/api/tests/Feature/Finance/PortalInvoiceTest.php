<?php

namespace Tests\Feature\Finance;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-008 Portal invoices (docs/FINANCE_CONTRACT.md section 4.6):
 * read-only, pinned to the client membership's own client record.
 */
class PortalInvoiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function asPortal(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user, 'portal'));
    }

    private function makeInvoice(int $agencyId, int $clientId, array $attrs = []): Invoice
    {
        $invoice = Invoice::factory()->create(array_merge([
            'agency_id' => $agencyId,
            'client_id' => $clientId,
            'status' => Invoice::STATUS_SENT,
            'sent_at' => now(),
            'subtotal' => 500,
            'tax_amount' => 0,
            'total' => 500,
        ], $attrs));
        $invoice->items()->create([
            'description' => 'Monthly retainer', 'quantity' => 1, 'unit_price' => 500,
            'amount' => 500, 'sort_order' => 0,
        ]);

        return $invoice;
    }

    public function test_portal_lists_only_own_client_invoices(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $agencyId = $owner->agency_id;
        $clientA = Client::factory()->create(['agency_id' => $agencyId]);
        $clientB = Client::factory()->create(['agency_id' => $agencyId]);

        $own = $this->makeInvoice($agencyId, $clientA->id);
        $other = $this->makeInvoice($agencyId, $clientB->id);

        $portal = $this->makePortalIdentity($agencyId, $clientA->id);

        $ids = collect($this->asPortal($portal)->getJson('/api/v1/portal/invoices')->assertOk()->json('data'))
            ->pluck('id');
        $this->assertTrue($ids->contains($own->id));
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_portal_show_includes_items_balance_and_payment_details(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $agencyId = $owner->agency_id;
        $client = Client::factory()->create(['agency_id' => $agencyId]);

        Agency::find($agencyId)->update([
            'bank_name' => 'Vietcombank',
            'bank_account_number' => '1234567890',
            'bank_account_holder' => 'Demo Agency',
            'vietqr_payload' => 'qr-static-payload',
        ]);

        $invoice = $this->makeInvoice($agencyId, $client->id);
        $portal = $this->makePortalIdentity($agencyId, $client->id);

        $this->asPortal($portal)->getJson("/api/v1/portal/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.number', $invoice->number)
            ->assertJsonPath('data.status', Invoice::STATUS_SENT)
            ->assertJsonPath('data.total', '500.00')
            ->assertJsonPath('data.paid_total', '0.00')
            ->assertJsonPath('data.balance_due', '500.00')
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.payment_details.bank_name', 'Vietcombank')
            ->assertJsonPath('data.payment_details.bank_account_number', '1234567890')
            // Payment records and internal fields stay internal.
            ->assertJsonMissingPath('data.payments')
            ->assertJsonMissingPath('data.stored_status');
    }

    public function test_portal_cannot_see_another_clients_invoice(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $agencyId = $owner->agency_id;
        $clientA = Client::factory()->create(['agency_id' => $agencyId]);
        $clientB = Client::factory()->create(['agency_id' => $agencyId]);
        $foreign = $this->makeInvoice($agencyId, $clientB->id);

        $portal = $this->makePortalIdentity($agencyId, $clientA->id);
        $this->asPortal($portal)->getJson("/api/v1/portal/invoices/{$foreign->id}")->assertNotFound();

        // An invoice of a different agency is equally invisible.
        $otherOwner = $this->makeMembershipUser([Role::OWNER]);
        $otherClient = Client::factory()->create(['agency_id' => $otherOwner->agency_id]);
        $otherInvoice = $this->makeInvoice($otherOwner->agency_id, $otherClient->id);
        $this->asPortal($portal)->getJson("/api/v1/portal/invoices/{$otherInvoice->id}")->assertNotFound();
    }

    public function test_portal_cannot_record_payments(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $agencyId = $owner->agency_id;
        $client = Client::factory()->create(['agency_id' => $agencyId]);
        $invoice = $this->makeInvoice($agencyId, $client->id);
        $portal = $this->makePortalIdentity($agencyId, $client->id);

        // No such route exists in the Portal surface at all.
        $this->asPortal($portal)->postJson("/api/v1/portal/invoices/{$invoice->id}/payments", [
            'amount' => 500, 'method' => 'bank_transfer',
        ])->assertNotFound();

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_portal_project_view_hides_finance_figures(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $agencyId = $owner->agency_id;
        $client = Client::factory()->create(['agency_id' => $agencyId]);
        $project = Project::factory()->create([
            'agency_id' => $agencyId, 'client_id' => $client->id, 'budget' => 10000,
            // DEC-028 Q2: draft projects are hidden from the Portal.
            'status' => Project::STATUS_IN_PROGRESS,
        ]);
        $this->makeInvoice($agencyId, $client->id, ['project_id' => $project->id]);

        $portal = $this->makePortalIdentity($agencyId, $client->id);
        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$project->id}")
            ->assertOk()
            ->assertJsonMissingPath('data.invoiced_total')
            ->assertJsonMissingPath('data.collected_total')
            ->assertJsonMissingPath('data.remaining_budget')
            ->assertJsonMissingPath('data.budget');
    }
}
