<?php

namespace Tests\Feature\Leads;

use App\Models\Client;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * BE-005 CRM/Lead module (docs/CRM_CONTRACT.md): CRUD, tenancy isolation,
 * RBAC matrix, shared contacts, notes, follow-up activities, pipeline
 * summary and the Lead → Client conversion rules.
 */
class LeadModuleTest extends TestCase
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

    private function makeLead(User $owner, array $attrs = []): Lead
    {
        return Lead::factory()->create(array_merge(['agency_id' => $owner->agency_id], $attrs));
    }

    public function test_owner_creates_lead_and_response_reflects_defaults(): void
    {
        $owner = $this->makeUser();

        $this->as($owner)->postJson('/api/v1/leads', [
            'name' => 'Website redesign inquiry',
            'company_name' => 'Acme Corp',
            'contact_name' => 'Jane Tran',
            'email' => 'jane@acme.test',
            'owner_id' => $owner->id,
            'estimated_value' => 12000,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Website redesign inquiry')
            ->assertJsonPath('data.status', Lead::STATUS_NEW)
            ->assertJsonPath('data.source', 'other')
            ->assertJsonPath('data.owner.id', $owner->id)
            ->assertJsonPath('data.converted_client_id', null);
    }

    public function test_create_lead_requires_name(): void
    {
        $owner = $this->makeUser();

        $this->as($owner)->postJson('/api/v1/leads', ['company_name' => 'No Name Co'])
            ->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_list_filters_by_status_owner_source_and_search(): void
    {
        $owner = $this->makeUser();
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $this->makeLead($owner, ['name' => 'Alpha Deal', 'company_name' => 'Alpha LLC', 'status' => 'new', 'source' => 'website', 'owner_id' => $sales->id]);
        $this->makeLead($owner, ['name' => 'Beta Deal', 'status' => 'qualified', 'source' => 'referral']);

        $this->as($owner)->getJson('/api/v1/leads?status=qualified')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Beta Deal');
        $this->as($owner)->getJson('/api/v1/leads?owner_id='.$sales->id)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Alpha Deal');
        $this->as($owner)->getJson('/api/v1/leads?source=website')
            ->assertOk()->assertJsonCount(1, 'data');
        $this->as($owner)->getJson('/api/v1/leads?q=Alpha')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Alpha Deal');
    }

    public function test_role_matrix_is_enforced(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner);
        $team = $this->makeUser([Role::TEAM_MEMBER], $owner->agency_id);
        $pm = $this->makeUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $accountant = $this->makeUser([Role::ACCOUNTANT], $owner->agency_id);
        $admin = $this->makeUser([Role::ADMIN], $owner->agency_id);
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);

        // DEC-014: Team Member has no leads.* at all.
        $this->as($team)->getJson('/api/v1/leads')->assertForbidden();
        // PM + Accountant are read-only.
        $this->as($pm)->getJson('/api/v1/leads')->assertOk();
        $this->as($pm)->postJson('/api/v1/leads', ['name' => 'Nope'])->assertForbidden();
        $this->as($accountant)->getJson('/api/v1/leads/'.$lead->id)->assertOk();
        $this->as($accountant)->patchJson('/api/v1/leads/'.$lead->id, ['name' => 'Nope'])->assertForbidden();
        // Sales can create/update/convert but not delete.
        $salesLeadId = $this->as($sales)->postJson('/api/v1/leads', ['name' => 'Sales Lead'])
            ->assertCreated()->json('data.id');
        $this->as($sales)->patchJson('/api/v1/leads/'.$salesLeadId, ['status' => 'contacted'])->assertOk();
        $this->as($sales)->deleteJson('/api/v1/leads/'.$lead->id)->assertForbidden();
        // Admin CAN delete leads (unlike clients, DEC-014).
        $this->as($admin)->deleteJson('/api/v1/leads/'.$lead->id)->assertNoContent();
        $this->assertSoftDeleted('leads', ['id' => $lead->id]);
    }

    public function test_cross_tenant_lead_is_not_visible(): void
    {
        $ownerA = $this->makeUser();
        $leadA = $this->makeLead($ownerA);
        $ownerB = $this->makeUser();

        $this->as($ownerB)->getJson('/api/v1/leads/'.$leadA->id)->assertNotFound();
        $this->as($ownerB)->getJson('/api/v1/leads')->assertOk()->assertJsonCount(0, 'data');
        $this->as($ownerB)->patchJson('/api/v1/leads/'.$leadA->id, ['name' => 'Hijack'])->assertNotFound();
        $this->as($ownerB)->postJson('/api/v1/leads/'.$leadA->id.'/convert')->assertNotFound();
    }

    public function test_cross_tenant_owner_reference_is_rejected(): void
    {
        $ownerA = $this->makeUser();
        $ownerB = $this->makeUser();

        $this->as($ownerA)->postJson('/api/v1/leads', [
            'name' => 'X', 'owner_id' => $ownerB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        $lead = $this->makeLead($ownerA);
        $this->as($ownerA)->postJson('/api/v1/leads/'.$lead->id.'/convert', [
            'account_manager_id' => $ownerB->id,
        ])->assertStatus(422)->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');
    }

    public function test_convert_company_lead_creates_client_organization_and_contacts(): void
    {
        $owner = $this->makeUser();
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $lead = $this->makeLead($owner, [
            'name' => 'Acme expansion',
            'company_name' => 'Acme Corp',
            'contact_name' => 'Jane Tran',
            'email' => 'jane@acme.test',
            'phone' => '0901234567',
            'owner_id' => $sales->id,
            'status' => 'qualified',
        ]);
        // An extra contact attached to the lead beforehand.
        $attached = Contact::factory()->create([
            'agency_id' => $owner->agency_id,
            'client_id' => null,
            'lead_id' => $lead->id,
            'full_name' => 'Bob Nguyen',
            'email' => 'bob@acme.test',
        ]);

        $response = $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert');

        $clientId = $response->assertCreated()
            ->assertJsonPath('data.name', 'Acme Corp')
            ->assertJsonPath('data.type', Client::TYPE_COMPANY)
            ->assertJsonPath('data.status', Client::STATUS_ACTIVE)
            ->assertJsonPath('data.source_lead_id', $lead->id)
            ->assertJsonPath('data.organization.legal_name', 'Acme Corp')
            ->assertJsonPath('data.account_manager.id', $sales->id)
            ->json('data.id');

        // The lead points at the client and is stamped.
        $lead->refresh();
        $this->assertSame($clientId, $lead->converted_client_id);
        $this->assertNotNull($lead->converted_at);

        // The attached contact was re-linked to the client.
        $attached->refresh();
        $this->assertSame($clientId, $attached->client_id);
        $this->assertNull($attached->lead_id);

        // A primary contact was built from the lead's own fields.
        $primary = Contact::where('client_id', $clientId)->where('is_primary', true)->first();
        $this->assertNotNull($primary);
        $this->assertSame('Jane Tran', $primary->full_name);
        $this->assertSame('jane@acme.test', $primary->email);
    }

    public function test_convert_individual_lead_creates_individual_client_without_organization(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner, [
            'name' => 'Solo founder',
            'company_name' => null,
            'contact_name' => 'Solo Founder',
            'email' => 'solo@founder.test',
        ]);

        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert')
            ->assertCreated()
            ->assertJsonPath('data.type', Client::TYPE_INDIVIDUAL)
            ->assertJsonPath('data.name', 'Solo founder')
            ->assertJsonPath('data.organization', null);
    }

    public function test_convert_twice_returns_409(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner, ['email' => 'once@deal.test']);

        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert')->assertCreated();
        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert')
            ->assertStatus(409)->assertJsonPath('error.code', 'LEAD_ALREADY_CONVERTED');
    }

    public function test_convert_duplicate_client_guard_and_force_override(): void
    {
        $owner = $this->makeUser();
        Client::factory()->create(['agency_id' => $owner->agency_id, 'email' => 'dupe@acme.test']);
        $lead = $this->makeLead($owner, ['email' => 'dupe@acme.test', 'company_name' => 'Dupe Co']);

        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert')
            ->assertStatus(422)->assertJsonPath('error.code', 'DUPLICATE_CLIENT_CANDIDATE');
        $this->assertNull($lead->refresh()->converted_client_id);

        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert', ['force' => true])
            ->assertCreated()
            ->assertJsonPath('data.source_lead_id', $lead->id);
    }

    public function test_converted_lead_is_locked_but_history_stays_writable(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner, ['email' => 'lock@deal.test']);
        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/convert')->assertCreated();

        $this->as($owner)->patchJson('/api/v1/leads/'.$lead->id, ['name' => 'Rename attempt'])
            ->assertStatus(409)->assertJsonPath('error.code', 'LEAD_ALREADY_CONVERTED');

        // Notes and activities may still be added to preserve history.
        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/notes', ['body' => 'Post-conversion note'])
            ->assertCreated();
        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/activities', [
            'type' => 'call', 'scheduled_at' => now()->addDay()->toISOString(),
        ])->assertCreated();
        // And the lead itself stays readable.
        $this->as($owner)->getJson('/api/v1/leads/'.$lead->id)
            ->assertOk()->assertJsonPath('data.converted_client_id', $lead->refresh()->converted_client_id);
    }

    public function test_lead_notes_follow_client_note_author_rules(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner);
        $sales = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);
        $sales2 = $this->makeUser([Role::SALES_MANAGER], $owner->agency_id);

        $noteId = $this->as($sales)->postJson('/api/v1/leads/'.$lead->id.'/notes', [
            'body' => 'Lead prefers Zalo over email.',
        ])->assertCreated()
            ->assertJsonPath('data.author.id', $sales->id)
            ->json('data.id');

        $this->as($owner)->getJson('/api/v1/leads/'.$lead->id.'/notes')
            ->assertOk()->assertJsonPath('data.0.body', 'Lead prefers Zalo over email.');

        $this->as($sales2)->deleteJson('/api/v1/leads/'.$lead->id.'/notes/'.$noteId)->assertForbidden();
        $this->as($sales)->deleteJson('/api/v1/leads/'.$lead->id.'/notes/'.$noteId)->assertNoContent();
    }

    public function test_lead_contacts_crud_and_lead_scoping(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner);
        $other = $this->makeLead($owner);

        $contactId = $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/contacts', [
            'full_name' => 'Jane Tran', 'email' => 'jane@acme.test', 'is_primary' => true,
        ])->assertCreated()
            ->assertJsonPath('data.lead_id', $lead->id)
            ->assertJsonPath('data.client_id', null)
            ->json('data.id');

        $this->as($owner)->patchJson('/api/v1/leads/'.$lead->id.'/contacts/'.$contactId, [
            'position' => 'CEO',
        ])->assertOk()->assertJsonPath('data.position', 'CEO');

        // The same contact id under another lead is a 404, not a leak.
        $this->as($owner)->patchJson('/api/v1/leads/'.$other->id.'/contacts/'.$contactId, [
            'position' => 'Hijack',
        ])->assertNotFound();

        $this->as($owner)->deleteJson('/api/v1/leads/'.$lead->id.'/contacts/'.$contactId)->assertNoContent();
        $this->as($owner)->getJson('/api/v1/leads/'.$lead->id.'/contacts')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_activities_completion_flow_and_due_list(): void
    {
        $owner = $this->makeUser();
        $lead = $this->makeLead($owner);
        $otherAgencyLead = $this->makeLead($this->makeUser());

        $dueId = $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/activities', [
            'type' => 'call', 'scheduled_at' => now()->subHour()->toISOString(), 'note' => 'Call back',
        ])->assertCreated()
            ->assertJsonPath('data.is_done', false)
            ->assertJsonPath('data.creator.id', $owner->id)
            ->json('data.id');

        // A future activity and an already-done past activity are not due.
        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/activities', [
            'type' => 'meeting', 'scheduled_at' => now()->addDays(2)->toISOString(),
        ])->assertCreated();
        $this->as($owner)->postJson('/api/v1/leads/'.$lead->id.'/activities', [
            'type' => 'message', 'scheduled_at' => now()->subDay()->toISOString(), 'is_done' => true,
        ])->assertCreated();
        // Another agency's due activity must never leak into the list.
        $foreign = $this->makeUser([Role::OWNER], $otherAgencyLead->agency_id);
        $this->as($foreign)->postJson('/api/v1/leads/'.$otherAgencyLead->id.'/activities', [
            'type' => 'call', 'scheduled_at' => now()->subHour()->toISOString(),
        ])->assertCreated();

        $this->as($owner)->getJson('/api/v1/lead-activities/due')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $dueId)
            ->assertJsonPath('data.0.lead.id', $lead->id);

        // Completing stamps completed_at and removes it from the due list.
        $this->as($owner)->patchJson('/api/v1/leads/'.$lead->id.'/activities/'.$dueId, ['is_done' => true])
            ->assertOk()
            ->assertJsonPath('data.is_done', true)
            ->assertJsonPath('data.completed_at', fn ($value) => $value !== null);
        $this->as($owner)->getJson('/api/v1/lead-activities/due')
            ->assertOk()->assertJsonCount(0, 'data');

        // Reopening clears the stamp.
        $this->as($owner)->patchJson('/api/v1/leads/'.$lead->id.'/activities/'.$dueId, ['is_done' => false])
            ->assertOk()
            ->assertJsonPath('data.completed_at', null);
    }

    public function test_pipeline_summary_matches_data(): void
    {
        $owner = $this->makeUser();
        $this->makeLead($owner, ['status' => 'new', 'estimated_value' => 1000]);
        $this->makeLead($owner, ['status' => 'new', 'estimated_value' => 2500]);
        $this->makeLead($owner, ['status' => 'qualified', 'estimated_value' => 4000]);
        $this->makeLead($owner, ['status' => 'unqualified', 'estimated_value' => null]);

        $data = $this->as($owner)->getJson('/api/v1/leads/pipeline-summary')
            ->assertOk()->json('data');

        $byStatus = collect($data)->keyBy('status');
        $this->assertSame(2, $byStatus['new']['leads_count']);
        $this->assertEquals(3500.0, $byStatus['new']['total_estimated_value']);
        $this->assertSame(1, $byStatus['qualified']['leads_count']);
        $this->assertEquals(4000.0, $byStatus['qualified']['total_estimated_value']);
        $this->assertSame(0, $byStatus['contacted']['leads_count']);
        $this->assertSame(1, $byStatus['unqualified']['leads_count']);
        $this->assertEquals(0.0, $byStatus['unqualified']['total_estimated_value']);
    }

    public function test_portal_token_cannot_use_lead_module(): void
    {
        $owner = $this->makeUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $identity = $this->makePortalIdentity($owner->agency_id, $client->id);
        $portalToken = $this->boundTokenFor($identity, 'portal');

        $this->withFreshToken($portalToken)->getJson('/api/v1/leads')->assertForbidden();
    }
}
