<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\GuardsAdminManagement;
use App\Http\Controllers\Controller;
use App\Http\Requests\Invitations\AcceptInvitationRequest;
use App\Http\Requests\Invitations\StoreInvitationRequest;
use App\Http\Resources\InvitationResource;
use App\Mail\InvitationMail;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/** Member invitations (docs/TEAM_CONTRACT.md endpoints 13-17). */
class InvitationController extends Controller
{
    use GuardsAdminManagement;

    public function index(Request $request): JsonResponse
    {
        $invitations = Invitation::query()
            ->with('inviter')
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return InvitationResource::collection($invitations)->response();
    }

    public function store(StoreInvitationRequest $request): JsonResponse
    {
        $actor = $request->user();
        $email = Str::lower($request->validated('email'));
        $roleIds = array_map('intval', $request->validated('role_ids'));

        $this->guardAdminManagement($actor, null, $roleIds);
        $this->guardOwnerRoleNotInvited($roleIds);

        // DEC-018: inviting an email that already has an identity is
        // the normal path now — the invitation links to that identity
        // and accepting creates a membership only. It is rejected
        // only when the person is already an active staff member of
        // THIS agency, or holds a client membership here (rule Q3).
        $identity = User::where('email', $email)->first();
        if ($identity) {
            $alreadyStaff = $identity->hasActiveMembershipIn($actor->currentMembership()->agency_id);
            if ($alreadyStaff) {
                throw new ApiException('ALREADY_MEMBER', 422);
            }
            Membership::ensureNoKindConflict($identity->id, $actor->currentMembership()->agency_id, Membership::KIND_STAFF);
        }
        $pending = Invitation::where('email', $email)
            ->whereNull('accepted_at')->whereNull('revoked_at')->exists();
        if ($pending) {
            throw new ApiException('INVITATION_PENDING', 422);
        }

        $invitation = new Invitation([
            'email' => $email,
            'user_id' => $identity?->id,
            'role_ids' => $roleIds,
            'invited_by' => $actor->id,
        ]);
        $rawToken = $this->issueToken($invitation);
        $invitation->save();
        $this->sendMail($invitation, $rawToken);
        $invitation->load('inviter');

        return (new InvitationResource($invitation))->response()->setStatusCode(201);
    }

    public function resend(Request $request, Invitation $invitation): JsonResponse
    {
        if (! $invitation->isPending()) {
            throw new ApiException('INVITATION_ALREADY_ACCEPTED', 422);
        }
        $rawToken = $this->issueToken($invitation);
        $invitation->save();
        $this->sendMail($invitation, $rawToken);
        $invitation->load('inviter');

        return (new InvitationResource($invitation))->response();
    }

    public function destroy(Invitation $invitation): Response
    {
        if ($invitation->isPending()) {
            $invitation->update(['revoked_at' => now()]);
        }

        return response()->noContent();
    }

    /** Public endpoint: the invitee sets name + password and joins. */
    public function accept(AcceptInvitationRequest $request): JsonResponse
    {
        $invitation = Invitation::withoutGlobalScopes()
            ->where('token_hash', hash('sha256', $request->validated('token')))
            ->first();
        if (! $invitation || $invitation->revoked_at !== null) {
            abort(404);
        }
        if ($invitation->accepted_at !== null) {
            throw new ApiException('INVITATION_ALREADY_ACCEPTED', 422);
        }
        if ($invitation->isExpired()) {
            throw new ApiException('INVITATION_EXPIRED', 422);
        }
        // DEC-018: accepting creates (or reuses) the identity and
        // adds a staff membership in the invitation's agency. When
        // the email already has an identity, no new user and no new
        // password are created — the membership is the only result.
        $result = Tenant::run($invitation->agency_id, function () use ($invitation, $request) {
            $user = $invitation->user_id
                ? User::find($invitation->user_id)
                : User::where('email', $invitation->email)->first();

            Membership::ensureNoKindConflict(
                $user?->id ?? 0,
                $invitation->agency_id,
                Membership::KIND_STAFF
            );

            if (! $user) {
                $user = User::create([
                    'name' => $request->validated('name'),
                    'email' => $invitation->email,
                    'password' => Hash::make($request->validated('password')),
                    'locale' => 'en',
                    'is_active' => true,
                ]);
            }

            $membership = Membership::create([
                'user_id' => $user->id,
                'agency_id' => $invitation->agency_id,
                'kind' => Membership::KIND_STAFF,
                'is_active' => true,
            ]);
            $membership->roles()->sync($invitation->role_ids);
            $invitation->update(['accepted_at' => now(), 'user_id' => $user->id]);

            return $user;
        });

        return response()->json([
            'data' => [
                'user_id' => $result->id,
                'email' => $result->email,
                'agency_id' => $invitation->agency_id,
            ],
        ], 201);
    }

    private function issueToken(Invitation $invitation): string
    {
        $rawToken = Str::random(64);
        $invitation->token_hash = hash('sha256', $rawToken);
        $invitation->expires_at = now()->addDays(7);

        return $rawToken;
    }

    private function sendMail(Invitation $invitation, string $rawToken): void
    {
        $invitation->loadMissing(['agency', 'inviter']);
        $acceptUrl = rtrim(config('app.frontend_url'), '/').'/accept-invitation?token='.$rawToken;
        Mail::to($invitation->email)->send(new InvitationMail($invitation, $acceptUrl));
    }

    private function guardOwnerRoleNotInvited(array $roleIds): void
    {
        $ownerRoleId = Role::where('key', Role::OWNER)->value('id');
        if (in_array($ownerRoleId, $roleIds, true)) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }
    }
}
