<?php

namespace Tests\Feature\Teams;

use App\Models\Client;
use App\Models\Invitation;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Mockery;
use Symfony\Component\Mailer\Exception\TransportException;
use Tests\TestCase;

/**
 * FIX-045: a broken mail transport (e.g. the SMTP host is
 * unreachable) must not fail the action that created the
 * invitation. The invitation row is the source of truth and
 * stays pending, so the email can be sent again via resend
 * once the transport recovers.
 */
class InvitationMailResilienceTest extends TestCase
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

    /** Make every mail send throw the way an unreachable SMTP host does. */
    private function breakMailTransport(): void
    {
        $mailer = Mockery::mock();
        $mailer->shouldReceive('to')
            ->andThrow(new TransportException('Connection could not be established with host "mailpit:1025"'));
        Mail::swap($mailer);
    }

    private function teamMemberRoleId(): int
    {
        return Role::where('key', Role::TEAM_MEMBER)->value('id');
    }

    public function test_staff_invitation_is_created_even_when_the_mail_transport_fails(): void
    {
        $owner = $this->makeMembershipUser();
        $this->breakMailTransport();

        $response = $this->as($owner)->postJson('/api/v1/invitations', [
            'email' => 'new.member@example.com',
            'role_ids' => [$this->teamMemberRoleId()],
        ])->assertCreated()
            ->assertJsonPath('data.email', 'new.member@example.com');

        $invitation = Invitation::find($response->json('data.id'));
        $this->assertNotNull($invitation);
        $this->assertSame(Invitation::KIND_STAFF, $invitation->kind);
        $this->assertTrue($invitation->isPending());
    }

    public function test_resend_succeeds_even_when_the_mail_transport_fails(): void
    {
        Mail::fake();
        $owner = $this->makeMembershipUser();
        $created = $this->as($owner)->postJson('/api/v1/invitations', [
            'email' => 'pending.member@example.com',
            'role_ids' => [$this->teamMemberRoleId()],
        ])->assertCreated();

        $this->breakMailTransport();

        $this->as($owner)->postJson('/api/v1/invitations/'.$created->json('data.id').'/resend')
            ->assertOk()
            ->assertJsonPath('data.email', 'pending.member@example.com');

        $this->assertTrue(Invitation::find($created->json('data.id'))->isPending());
    }

    public function test_portal_grant_invitation_is_created_even_when_the_mail_transport_fails(): void
    {
        $owner = $this->makeMembershipUser();
        $client = Client::factory()->create(['agency_id' => $owner->agency_id]);
        $this->breakMailTransport();

        $response = $this->as($owner)->postJson("/api/v1/clients/{$client->id}/portal-accounts", [
            'email' => 'client.person@example.com',
        ])->assertCreated()
            ->assertJsonPath('data.kind', 'client')
            ->assertJsonPath('data.client_id', $client->id);

        $invitation = Invitation::find($response->json('data.id'));
        $this->assertNotNull($invitation);
        $this->assertSame(Invitation::KIND_CLIENT, $invitation->kind);
        $this->assertTrue($invitation->isPending());
    }
}
