<?php

namespace Tests\Feature\Workflow;

use App\Mail\NotificationMail;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Notification as AppNotification;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Tenant;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * BE-009 event catalogue (docs/WORKFLOW_CONTRACT.md section 4,
 * DEC-026): each trigger creates the right notification for the
 * right recipients — actor excluded, inactive memberships excluded —
 * and email follows the section 5 subset only.
 */
class NotificationEventsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    private function as(User $user): static
    {
        return $this->withFreshToken($this->boundTokenFor($user));
    }

    /** @return Collection<int, AppNotification> */
    private function notificationsFor(User $user, ?string $type = null): Collection
    {
        // Bypass reason: test-side inspection across the recipient's
        // rows; the query pins the user explicitly.
        return Tenant::bypass(fn () => AppNotification::query()
            ->where('user_id', $user->id)
            ->when($type, fn ($q) => $q->where('type', $type))
            ->orderBy('id')
            ->get());
    }

    private function makeProject(User $owner): Project
    {
        return Project::factory()->create([
            'agency_id' => $owner->agency_id,
            'client_id' => Client::factory()->create(['agency_id' => $owner->agency_id])->id,
        ]);
    }

    /** An invoice with stored totals, built like InvoiceModuleTest does it. */
    private function makeInvoice(User $creator, array $attrs = []): Invoice
    {
        $invoice = Invoice::factory()->create(array_merge([
            'agency_id' => $creator->agency_id,
            'client_id' => Client::factory()->create(['agency_id' => $creator->agency_id])->id,
            'created_by' => $creator->id,
        ], $attrs));

        $invoice->items()->create([
            'description' => 'Work', 'quantity' => 1, 'unit_price' => 100, 'amount' => 100, 'sort_order' => 0,
        ]);
        $invoice->recomputeTotals();
        $invoice->save();

        return $invoice->refresh();
    }

    public function test_task_created_with_assignee_notifies_assignee_and_sends_email(): void
    {
        Mail::fake();
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Design homepage',
            'assignee_id' => $member->id,
        ])->assertCreated();

        $notifications = $this->notificationsFor($member, Notifier::TYPE_TASK_ASSIGNED);
        $this->assertCount(1, $notifications);
        $this->assertSame('Design homepage', $notifications->first()->data['task_title']);
        $this->assertSame($owner->agency_id, $notifications->first()->agency_id);
        $this->assertCount(0, $this->notificationsFor($owner));

        // task.assigned is in the email subset (contract section 5).
        Mail::assertSent(NotificationMail::class, fn ($mail) => $mail->type === Notifier::TYPE_TASK_ASSIGNED);
    }

    public function test_task_created_without_assignee_notifies_nobody(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $project = $this->makeProject($owner);

        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Unassigned task',
        ])->assertCreated();

        $this->assertCount(0, $this->notificationsFor($owner));
    }

    public function test_actor_assigning_a_task_to_themselves_is_not_notified(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $project = $this->makeProject($owner);

        $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Own task',
            'assignee_id' => $owner->id,
        ])->assertCreated();

        $this->assertCount(0, $this->notificationsFor($owner));
    }

    public function test_assignee_change_notifies_only_the_new_assignee(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $first = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $second = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        $taskId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Handover task',
            'assignee_id' => $first->id,
        ])->assertCreated()->json('data.id');

        $this->as($owner)->patchJson("/api/v1/tasks/{$taskId}", ['assignee_id' => $second->id])->assertOk();
        // Re-saving the same assignee is not a change -> no new event.
        $this->as($owner)->patchJson("/api/v1/tasks/{$taskId}", ['assignee_id' => $second->id])->assertOk();

        $this->assertCount(1, $this->notificationsFor($first, Notifier::TYPE_TASK_ASSIGNED));
        $this->assertCount(1, $this->notificationsFor($second, Notifier::TYPE_TASK_ASSIGNED));
    }

    public function test_status_change_notifies_assignee_and_creator_except_the_actor(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        $taskId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Build API',
            'assignee_id' => $member->id,
        ])->assertCreated()->json('data.id');

        // The assignee moves the task: the creator hears about it,
        // the assignee (actor) does not.
        $this->as($member)->patchJson("/api/v1/tasks/{$taskId}", ['status' => 'in_progress'])->assertOk();

        $ownerEvents = $this->notificationsFor($owner, Notifier::TYPE_TASK_STATUS_CHANGED);
        $this->assertCount(1, $ownerEvents);
        $this->assertSame('todo', $ownerEvents->first()->data['from_status']);
        $this->assertSame('in_progress', $ownerEvents->first()->data['to_status']);
        $this->assertCount(0, $this->notificationsFor($member, Notifier::TYPE_TASK_STATUS_CHANGED));

        // The creator moves it back: now the assignee hears about it.
        $this->as($owner)->patchJson("/api/v1/tasks/{$taskId}", ['status' => 'in_review'])->assertOk();

        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_TASK_STATUS_CHANGED));
        $this->assertCount(1, $this->notificationsFor($owner, Notifier::TYPE_TASK_STATUS_CHANGED));
    }

    public function test_comment_notifies_assignee_and_creator_except_the_author(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $admin = $this->makeMembershipUser([Role::ADMIN], $owner->agency_id);
        $project = $this->makeProject($owner);

        $taskId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Review copy',
            'assignee_id' => $member->id,
        ])->assertCreated()->json('data.id');

        // A third person comments: assignee + creator are notified.
        $this->as($admin)->postJson("/api/v1/tasks/{$taskId}/comments", ['body' => 'Looks good'])
            ->assertCreated();

        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_TASK_COMMENTED));
        $this->assertCount(1, $this->notificationsFor($owner, Notifier::TYPE_TASK_COMMENTED));
        $this->assertCount(0, $this->notificationsFor($admin, Notifier::TYPE_TASK_COMMENTED));

        // The creator comments: only the assignee is notified.
        $this->as($owner)->postJson("/api/v1/tasks/{$taskId}/comments", ['body' => 'Thanks'])
            ->assertCreated();

        $this->assertCount(2, $this->notificationsFor($member, Notifier::TYPE_TASK_COMMENTED));
        $this->assertCount(1, $this->notificationsFor($owner, Notifier::TYPE_TASK_COMMENTED));
    }

    public function test_invoice_send_notifies_the_creator_and_sends_no_email(): void
    {
        Mail::fake();
        $creator = $this->makeMembershipUser([Role::OWNER]);
        $admin = $this->makeMembershipUser([Role::ADMIN], $creator->agency_id);
        $invoice = $this->makeInvoice($creator);

        $this->as($admin)->postJson("/api/v1/invoices/{$invoice->id}/send")->assertOk();

        $events = $this->notificationsFor($creator, Notifier::TYPE_INVOICE_STATUS_CHANGED);
        $this->assertCount(1, $events);
        $this->assertSame('draft', $events->first()->data['from_status']);
        $this->assertSame('sent', $events->first()->data['to_status']);
        $this->assertCount(0, $this->notificationsFor($admin));

        // Only "paid" is emailed (contract section 5).
        Mail::assertNothingSent();
    }

    public function test_creator_sending_their_own_invoice_is_not_notified(): void
    {
        $creator = $this->makeMembershipUser([Role::OWNER]);
        $invoice = $this->makeInvoice($creator);

        $this->as($creator)->postJson("/api/v1/invoices/{$invoice->id}/send")->assertOk();

        $this->assertCount(0, $this->notificationsFor($creator));
    }

    public function test_invoice_cancel_notifies_the_creator(): void
    {
        $creator = $this->makeMembershipUser([Role::OWNER]);
        $admin = $this->makeMembershipUser([Role::ADMIN], $creator->agency_id);
        $invoice = $this->makeInvoice($creator, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);

        $this->as($admin)->postJson("/api/v1/invoices/{$invoice->id}/cancel")->assertOk();

        $events = $this->notificationsFor($creator, Notifier::TYPE_INVOICE_STATUS_CHANGED);
        $this->assertCount(1, $events);
        $this->assertSame('cancelled', $events->first()->data['to_status']);
    }

    public function test_payment_completing_coverage_notifies_creator_and_emails_paid(): void
    {
        Mail::fake();
        $creator = $this->makeMembershipUser([Role::OWNER]);
        $accountant = $this->makeMembershipUser([Role::ACCOUNTANT], $creator->agency_id);
        $invoice = $this->makeInvoice($creator, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);

        // A partial payment changes no stored status -> no event.
        $this->as($accountant)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 40, 'method' => 'bank_transfer',
        ])->assertCreated();
        $this->assertCount(0, $this->notificationsFor($creator, Notifier::TYPE_INVOICE_STATUS_CHANGED));

        // The completing payment flips Sent -> Paid: event + email.
        $this->as($accountant)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 60, 'method' => 'bank_transfer',
        ])->assertCreated();

        $events = $this->notificationsFor($creator, Notifier::TYPE_INVOICE_STATUS_CHANGED);
        $this->assertCount(1, $events);
        $this->assertSame('paid', $events->first()->data['to_status']);
        Mail::assertSent(NotificationMail::class, fn ($mail) => $mail->type === Notifier::TYPE_INVOICE_STATUS_CHANGED);
    }

    public function test_payment_delete_reverting_paid_notifies_creator_again(): void
    {
        $creator = $this->makeMembershipUser([Role::OWNER]);
        $accountant = $this->makeMembershipUser([Role::ACCOUNTANT], $creator->agency_id);
        $invoice = $this->makeInvoice($creator, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);

        $paymentId = $this->as($accountant)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 100, 'method' => 'cash',
        ])->assertCreated()->json('data.id');
        $this->assertSame(Invoice::STATUS_PAID, $invoice->refresh()->status);

        $this->as($accountant)->deleteJson("/api/v1/payments/{$paymentId}")->assertNoContent();
        $this->assertSame(Invoice::STATUS_SENT, $invoice->refresh()->status);

        $events = $this->notificationsFor($creator, Notifier::TYPE_INVOICE_STATUS_CHANGED);
        $this->assertCount(2, $events);
        $this->assertSame('paid', $events->first()->data['to_status']);
        $this->assertSame('paid', $events->last()->data['from_status']);
        $this->assertSame('sent', $events->last()->data['to_status']);
    }

    public function test_editing_only_the_task_title_fires_no_notification(): void
    {
        Mail::fake();
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        $taskId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Draft title',
            'assignee_id' => $member->id,
        ])->assertCreated()->json('data.id');

        // Creation notified the assignee exactly once.
        $this->assertCount(1, $this->notificationsFor($member));

        // A title-only edit changes neither assignee nor status:
        // no event may fire (QA review F2 on PR #95).
        $this->as($owner)->patchJson("/api/v1/tasks/{$taskId}", ['title' => 'Final title'])->assertOk();

        $this->assertCount(1, $this->notificationsFor($member));
        $this->assertCount(0, $this->notificationsFor($owner));
        Mail::assertSentCount(1);
    }

    public function test_creator_recording_the_completing_payment_on_their_own_invoice_is_not_notified(): void
    {
        Mail::fake();
        $creator = $this->makeMembershipUser([Role::OWNER]);
        $invoice = $this->makeInvoice($creator, ['status' => Invoice::STATUS_SENT, 'sent_at' => now()]);

        // The creator is the actor of the Sent -> Paid transition:
        // actor exclusion wins over the creator recipient rule, and
        // no paid email goes out either (QA review F4 on PR #95).
        $this->as($creator)->postJson("/api/v1/invoices/{$invoice->id}/payments", [
            'amount' => 100, 'method' => 'bank_transfer',
        ])->assertCreated();

        $this->assertCount(0, $this->notificationsFor($creator, Notifier::TYPE_INVOICE_STATUS_CHANGED));
        Mail::assertNothingSent();
    }

    public function test_recipient_with_an_inactive_membership_gets_no_notification(): void
    {
        $owner = $this->makeMembershipUser([Role::OWNER]);
        $member = $this->makeMembershipUser([Role::TEAM_MEMBER], $owner->agency_id);
        $project = $this->makeProject($owner);

        $taskId = $this->as($owner)->postJson("/api/v1/projects/{$project->id}/tasks", [
            'title' => 'Task of a soon-departed member',
            'assignee_id' => $member->id,
        ])->assertCreated()->json('data.id');
        $this->assertCount(1, $this->notificationsFor($member, Notifier::TYPE_TASK_ASSIGNED));

        // The membership is deactivated afterwards: later events for
        // the same person in this agency create nothing. (Assigning a
        // NEW task to them is impossible — the task form request
        // rejects inactive assignees with CROSS_TENANT_REFERENCE.)
        $member->testMembership->deactivate();

        $this->as($owner)->patchJson("/api/v1/tasks/{$taskId}", ['status' => 'in_progress'])->assertOk();

        $this->assertCount(0, $this->notificationsFor($member, Notifier::TYPE_TASK_STATUS_CHANGED));
    }
}
