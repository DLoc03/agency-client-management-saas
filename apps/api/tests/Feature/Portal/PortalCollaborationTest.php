<?php

namespace Tests\Feature\Portal;

use App\Models\ApprovalRequest;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Notification as AppNotification;
use App\Models\Payment;
use App\Models\PortalComment;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\Role;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * BE-011 collaboration surfaces (docs/PORTAL_CONTRACT.md sections
 * 3/5/6, DEC-028 Q5–Q9/Q12): the per-project discussion thread and
 * its staff notifications, the approval lifecycle, the dashboard
 * aggregate and the composed communication history.
 */
class PortalCollaborationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('local');
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    private function asPortal(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user, 'portal'));
    }

    /** @return Collection<int, AppNotification> */
    private function notificationsFor(User $user, ?string $type = null): Collection
    {
        // Bypass reason: test-side inspection; the query pins the
        // recipient explicitly.
        return Tenant::bypass(fn () => AppNotification::query()
            ->where('user_id', $user->id)
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderBy('id')
            ->get());
    }

    private function makeProject(User $owner, int $clientId, array $attrs = []): Project
    {
        return Project::factory()->create(array_merge([
            'agency_id' => $owner->agency_id,
            'client_id' => $clientId,
            'status' => Project::STATUS_IN_PROGRESS,
        ], $attrs));
    }

    public function test_client_comment_notifies_project_manager_and_members_only_and_staff_reply_is_shared(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);

        $pm = $this->makeMembershipUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $outsider = $this->makeMembershipUser([Role::PROJECT_MANAGER], $owner->agency_id);

        $project = $this->makeProject($owner, $client->id, ['project_manager_id' => $pm->id]);
        $project->members()->attach($member->id);

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);
        $this->asPortal($portal)->postJson("/api/v1/portal/projects/{$project->id}/comments", [
            'body' => 'We reviewed the draft, looks good.',
        ])->assertCreated()
            ->assertJsonPath('data.author_kind', 'client');

        // portal.comment goes to the project manager + project
        // members — not to staff outside the project, not the owner
        // (who is neither here), and no email-type side effects.
        $this->assertCount(1, $this->notificationsFor($pm, Notifier::TYPE_PORTAL_COMMENT));
        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_PORTAL_COMMENT));
        $this->assertCount(0, $this->notificationsFor($outsider, Notifier::TYPE_PORTAL_COMMENT));
        $this->assertCount(0, $this->notificationsFor($owner, Notifier::TYPE_PORTAL_COMMENT));

        // Staff read the same thread and reply with projects.view
        // only; the reply creates no staff notification.
        $this->as($member)->getJson("/api/v1/projects/{$project->id}/portal-comments")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.body', 'We reviewed the draft, looks good.');

        $this->as($member)->postJson("/api/v1/projects/{$project->id}/portal-comments", [
            'body' => 'Thanks, final files follow today.',
        ])->assertCreated()
            ->assertJsonPath('data.author_kind', 'staff');

        $this->assertCount(1, $this->notificationsFor($pm, Notifier::TYPE_PORTAL_COMMENT));

        // The client sees the reply in the same thread.
        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$project->id}/comments")
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.author_kind', 'staff');

        // Another client cannot read the thread at all.
        $otherClient = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $stranger = $this->makePortalIdentity($owner->agency_id, $otherClient->id);
        $this->asPortal($stranger)->getJson("/api/v1/portal/projects/{$project->id}/comments")
            ->assertNotFound();
    }

    public function test_approval_lifecycle_with_notifications_and_immutability(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $pm = $this->makeMembershipUser([Role::PROJECT_MANAGER], $owner->agency_id);
        $project = $this->makeProject($owner, $client->id, ['project_manager_id' => $pm->id]);

        // Staff create a request (title only — a written hand-over).
        $approvalId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/approvals", [
            'title' => 'Approve the homepage hand-over',
            'description' => 'Please check the staging link.',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->json('data.id');

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);
        $this->asPortal($portal)->getJson("/api/v1/portal/projects/{$project->id}/approvals")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Approve the homepage hand-over');

        // Requesting changes without a comment is a validation error.
        $this->asPortal($portal)->postJson("/api/v1/portal/projects/{$project->id}/approvals/{$approvalId}/respond", [
            'decision' => 'changes_requested',
        ])->assertUnprocessable();

        // The approval itself succeeds and notifies the creator
        // (and the project manager — here the same rule, deduped).
        $this->asPortal($portal)->postJson("/api/v1/portal/projects/{$project->id}/approvals/{$approvalId}/respond", [
            'decision' => 'approved',
            'comment' => 'Looks great, ship it.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.responded_by.id', $portal->id);

        $this->assertCount(1, $this->notificationsFor($owner, Notifier::TYPE_PORTAL_APPROVAL_RESPONSE));
        $this->assertCount(1, $this->notificationsFor($pm, Notifier::TYPE_PORTAL_APPROVAL_RESPONSE));

        // A responded request is immutable — for the client…
        $this->asPortal($portal)->postJson("/api/v1/portal/projects/{$project->id}/approvals/{$approvalId}/respond", [
            'decision' => 'changes_requested', 'comment' => 'Changed my mind',
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'APPROVAL_ALREADY_RESPONDED');

        // …and staff can no longer cancel it either.
        $this->as($owner)->deleteJson("/api/v1/projects/{$project->id}/approvals/{$approvalId}")
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'APPROVAL_ALREADY_RESPONDED');
    }

    public function test_second_account_of_the_same_client_may_respond_and_pending_can_be_cancelled(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        // Bypass reason: fixture setup; the record is pinned to
        // the project created above.
        $first = Tenant::bypass(fn () => ApprovalRequest::factory()->create([
            'project_id' => $project->id, 'created_by' => $owner->id,
        ]));
        // Bypass reason: fixture setup; the record is pinned to
        // the project created above.
        $second = Tenant::bypass(fn () => ApprovalRequest::factory()->create([
            'project_id' => $project->id, 'created_by' => $owner->id,
        ]));

        // A different portal account of the SAME client record
        // responds (Q12: first response wins).
        $colleague = $this->makePortalIdentity($owner->agency_id, $client->id);
        $this->asPortal($colleague)->postJson("/api/v1/portal/projects/{$project->id}/approvals/{$first->id}/respond", [
            'decision' => 'changes_requested', 'comment' => 'Please fix the logo size.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'changes_requested')
            ->assertJsonPath('data.responded_by.id', $colleague->id);

        // An account of a DIFFERENT client cannot even see it.
        $otherClient = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $stranger = $this->makePortalIdentity($owner->agency_id, $otherClient->id);
        $this->asPortal($stranger)->postJson("/api/v1/portal/projects/{$project->id}/approvals/{$second->id}/respond", [
            'decision' => 'approved',
        ])->assertNotFound();

        // Staff cancel a still-pending request.
        $this->as($owner)->deleteJson("/api/v1/projects/{$project->id}/approvals/{$second->id}")
            ->assertNoContent();
        $this->asPortal($colleague)->getJson("/api/v1/portal/projects/{$project->id}/approvals")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_approval_for_a_file_defaults_its_title_and_requires_the_manage_permission(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);
        // Bypass reason: fixture setup; the record is pinned to
        // the project created above.
        $file = Tenant::bypass(fn () => ProjectFile::factory()->create([
            'project_id' => $project->id, 'uploaded_by' => $owner->id,
            'original_name' => 'final-logo.pdf',
        ]));

        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/approvals", [
            'file_id' => $file->id,
        ])->assertCreated()
            ->assertJsonPath('data.title', 'final-logo.pdf')
            ->assertJsonPath('data.file_id', $file->id);

        // A file from another project is a cross-reference error.
        $otherProject = $this->makeProject($owner, $client->id);
        // Bypass reason: fixture setup; the record is pinned to
        // the other project created above.
        $foreignFile = Tenant::bypass(fn () => ProjectFile::factory()->create([
            'project_id' => $otherProject->id, 'uploaded_by' => $owner->id,
        ]));
        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/approvals", [
            'file_id' => $foreignFile->id,
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'CROSS_TENANT_REFERENCE');

        // Team Member (project member, projects.view only) cannot create.
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project->members()->attach($member->id);
        $this->as($member)->postJson("/api/v1/projects/{$project->id}/approvals", [
            'title' => 'Nope',
        ])->assertForbidden();
    }

    public function test_dashboard_aggregates_projects_pending_approvals_unpaid_and_recent_files(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);

        // Bypass reason: fixture setup; the record is pinned to
        // the project created above.
        Tenant::bypass(fn () => ApprovalRequest::factory()->create([
            'project_id' => $project->id, 'created_by' => $owner->id, 'title' => 'Sign off the mockups',
        ]));
        // Bypass reason: fixture setup; the record is pinned to
        // the project created above.
        Tenant::bypass(fn () => ProjectFile::factory()->create([
            'project_id' => $project->id, 'uploaded_by' => $owner->id, 'original_name' => 'mockups.pdf',
        ]));

        // One open invoice: 500 total, 200 paid → 300 due. A draft
        // invoice must not count as debt.
        $invoice = Invoice::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'project_id' => $project->id, 'status' => Invoice::STATUS_SENT,
            'sent_at' => now(), 'total' => 500,
        ]);
        Payment::factory()->create([
            'agency_id' => $owner->agency_id, 'invoice_id' => $invoice->id,
            'amount' => 200, 'recorded_by' => $owner->id,
        ]);
        Invoice::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'project_id' => $project->id, 'status' => Invoice::STATUS_DRAFT, 'total' => 999,
        ]);

        // A sent invoice on a DRAFT project must not count either:
        // like the rest of the dashboard, unpaid totals only speak
        // about portal-visible projects (Q2 consistency).
        $draftProject = $this->makeProject($owner, $client->id, ['status' => Project::STATUS_DRAFT]);
        Invoice::factory()->create([
            'agency_id' => $owner->agency_id, 'client_id' => $client->id,
            'project_id' => $draftProject->id, 'status' => Invoice::STATUS_SENT,
            'sent_at' => now(), 'total' => 400,
        ]);

        $portal = $this->makePortalIdentity($owner->agency_id, $client->id);
        $this->asPortal($portal)->getJson('/api/v1/portal/dashboard')
            ->assertOk()
            ->assertJsonCount(1, 'data.projects')
            ->assertJsonPath('data.pending_approvals.count', 1)
            ->assertJsonPath('data.pending_approvals.items.0.title', 'Sign off the mockups')
            ->assertJsonPath('data.unpaid_invoices.count', 1)
            ->assertJsonPath('data.unpaid_invoices.total_due', 300)
            ->assertJsonPath('data.recent_files.0.original_name', 'mockups.pdf');
    }

    public function test_history_composes_all_three_sources_newest_first_on_both_sides(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $project = $this->makeProject($owner, $client->id);
        $portalUser = $this->makePortalIdentity($owner->agency_id, $client->id);

        $base = now()->subDays(10);
        // Bypass reason: fixture setup; every record below is
        // pinned to an explicit agency/project/client.
        Tenant::bypass(function () use ($project, $owner, $portalUser, $client, $base) {
            $invoice = Invoice::factory()->create([
                'agency_id' => $owner->agency_id, 'client_id' => $client->id,
                'project_id' => $project->id, 'status' => Invoice::STATUS_PAID,
                'total' => 700, 'number' => 'INV-2026-0007',
                'sent_at' => $base, 'paid_at' => $base->copy()->addDays(4),
                'created_at' => $base,
            ]);

            PortalComment::factory()->create([
                'project_id' => $project->id, 'author_id' => $portalUser->id,
                'created_at' => $base->copy()->addDays(1),
            ]);

            ApprovalRequest::factory()->create([
                'project_id' => $project->id, 'created_by' => $owner->id,
                'status' => ApprovalRequest::STATUS_APPROVED,
                'responded_by' => $portalUser->id,
                'responded_at' => $base->copy()->addDays(3),
                'created_at' => $base->copy()->addDays(2),
            ]);

            // A draft invoice must never appear in the feed.
            Invoice::factory()->create([
                'agency_id' => $owner->agency_id, 'client_id' => $client->id,
                'project_id' => $project->id, 'status' => Invoice::STATUS_DRAFT, 'total' => 1,
            ]);
        });

        $expected = ['invoice_paid', 'approval_responded', 'approval_requested', 'comment', 'invoice_issued'];

        $portal = $this->asPortal($portalUser)->getJson("/api/v1/portal/projects/{$project->id}/history")
            ->assertOk();
        $this->assertSame($expected, collect($portal->json('data'))->pluck('type')->all());
        $portal->assertJsonPath('meta.total', 5);

        // The internal side reads the same feed.
        $internal = $this->as($owner)->getJson("/api/v1/projects/{$project->id}/history")->assertOk();
        $this->assertSame($expected, collect($internal->json('data'))->pluck('type')->all());
    }
}
