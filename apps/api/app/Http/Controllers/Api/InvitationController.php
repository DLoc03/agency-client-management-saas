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
use App\Models\PersonalAccessToken;
use App\Models\Role;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Throwable;

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
            'kind' => Invitation::KIND_STAFF,
            'role_ids' => $roleIds,
            'invited_by' => $actor->id,
        ]);
        $rawToken = $invitation->issueToken();
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
        $rawToken = $invitation->issueToken();
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

    /**
     * Public endpoint: describe a pending invitation for the accept
     * screen (BE-010, DEC-020). Possession of the token is the
     * credential; nothing beyond the invitation itself is exposed.
     */
    public function preview(Request $request): JsonResponse
    {
        $request->validate(['token' => ['required', 'string']]);
        $invitation = $this->findByToken((string) $request->query('token'));
        $invitation->load('agency');

        $authUser = auth('sanctum')->user();

        return response()->json([
            'data' => [
                'agency' => [
                    'id' => $invitation->agency_id,
                    'name' => $invitation->agency->name,
                ],
                'email' => $invitation->email,
                'kind' => $invitation->kind,
                'roles' => $invitation->kind === Invitation::KIND_STAFF
                    ? Role::whereIn('id', $invitation->role_ids ?? [])->pluck('key')->values()
                    : [],
                'has_identity' => $invitation->user_id !== null
                    || User::where('email', $invitation->email)->exists(),
                'matches_current_user' => $authUser
                    ? $authUser->email === $invitation->email
                    : null,
                'expires_at' => $invitation->expires_at,
            ],
        ]);
    }

    /**
     * Accept an invitation (BE-010 invitations v2, DEC-020).
     *
     * Three modes, driven by whether the invitee already has an
     * identity:
     * - Signed in as the invited identity: a plain confirmation —
     *   only the membership is created, no password is involved.
     * - Not signed in but the email already has an identity:
     *   403 INVITATION_LOGIN_REQUIRED — one identity, one password;
     *   the person signs in first, then confirms.
     * - Signed in as a DIFFERENT identity:
     *   403 INVITATION_IDENTITY_MISMATCH.
     * - Brand-new email (public): name + password create the
     *   identity, then the membership — the original flow.
     * Staff invitations grant the invited roles; client invitations
     * grant Portal access to the invitation's client record.
     */
    public function accept(AcceptInvitationRequest $request): JsonResponse
    {
        $invitation = $this->findByToken($request->validated('token'));

        $identity = $invitation->user_id
            ? User::find($invitation->user_id)
            : User::where('email', $invitation->email)->first();
        $authUser = auth('sanctum')->user();

        if (! $authUser && $request->bearerToken()) {
            // A bearer credential was presented but resolved to no user:
            // the token is unknown or expired. That is an authentication
            // failure (401), not "please log in" — while the public
            // no-bearer flow below (brand-new identity) stays untouched.
            // The lookup verifies the unguessable token hash only and
            // reads no tenant data (same basis as findByToken above).
            $accessToken = PersonalAccessToken::findToken($request->bearerToken());
            if (! $accessToken || ($accessToken->expires_at && $accessToken->expires_at->isPast())) {
                throw new AuthenticationException;
            }
        }

        if ($authUser) {
            if (! $identity || $identity->id !== $authUser->id) {
                throw new ApiException('INVITATION_IDENTITY_MISMATCH', 403);
            }
        } elseif ($identity) {
            throw new ApiException('INVITATION_LOGIN_REQUIRED', 403);
        } else {
            $request->validate([
                'name' => ['required', 'string', 'max:255'],
                'password' => ['required', Password::min(8)],
            ]);
        }

        $result = Tenant::run($invitation->agency_id, function () use ($invitation, $request, $identity) {
            $user = $identity;
            $kind = $invitation->kind === Invitation::KIND_CLIENT
                ? Membership::KIND_CLIENT
                : Membership::KIND_STAFF;

            Membership::ensureNoKindConflict(
                $user?->id ?? 0,
                $invitation->agency_id,
                $kind
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

            if ($kind === Membership::KIND_CLIENT) {
                $existing = Membership::where('user_id', $user->id)
                    ->where('kind', Membership::KIND_CLIENT)
                    ->where('client_id', $invitation->client_id)
                    ->where('is_active', true)
                    ->exists();
                if ($existing) {
                    throw new ApiException('EMAIL_ALREADY_REGISTERED', 422);
                }
                Membership::create([
                    'user_id' => $user->id,
                    'agency_id' => $invitation->agency_id,
                    'kind' => Membership::KIND_CLIENT,
                    'client_id' => $invitation->client_id,
                    'is_active' => true,
                ]);
            } else {
                $alreadyStaff = $user->hasActiveMembershipIn($invitation->agency_id);
                if ($alreadyStaff) {
                    throw new ApiException('ALREADY_MEMBER', 422);
                }
                $membership = Membership::create([
                    'user_id' => $user->id,
                    'agency_id' => $invitation->agency_id,
                    'kind' => Membership::KIND_STAFF,
                    'is_active' => true,
                ]);
                $membership->roles()->sync($invitation->role_ids);
            }

            $invitation->update(['accepted_at' => now(), 'user_id' => $user->id]);

            return $user;
        });

        // FIX-024 (DEC-030): an invitation-scoped login token is
        // one-shot — once the accept succeeds it has served its only
        // purpose, so it is deleted instead of lingering until expiry.
        if ($authUser) {
            $accessToken = $authUser->currentAccessToken();
            if ($accessToken && $accessToken->abilities === ['invitation']) {
                $accessToken->delete();
            }
        }

        return response()->json([
            'data' => [
                'user_id' => $result->id,
                'email' => $result->email,
                'agency_id' => $invitation->agency_id,
                'kind' => $invitation->kind,
            ],
        ], 201);
    }

    /** Shared token lookup + state guards for preview and accept. */
    private function findByToken(string $rawToken): Invitation
    {
        // Unscoped on purpose (repo AGENTS.md rule 3): the public
        // accept flow starts from the emailed link, before any tenant
        // context exists. The lookup key is the SHA-256 hash of an
        // unguessable 64-char token — the token is the credential —
        // and the agency is taken from the invitation row itself.
        $invitation = Invitation::withoutGlobalScopes()
            ->where('token_hash', hash('sha256', $rawToken))
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

        return $invitation;
    }

    private function sendMail(Invitation $invitation, string $rawToken): void
    {
        $invitation->loadMissing(['agency', 'inviter']);
        $acceptUrl = rtrim(config('app.frontend_url'), '/').'/accept-invitation?token='.$rawToken;
        try {
            Mail::to($invitation->email)->send(new InvitationMail($invitation, $acceptUrl));
        } catch (Throwable $e) {
            // FIX-045: a mail transport failure must not fail the
            // invitation itself — the row already exists and stays
            // pending, so the email can be sent again via resend
            // once the transport recovers (same isolation pattern
            // as App\Support\Notifier).
            Log::warning('Failed to send invitation email.', [
                'invitation_id' => $invitation->id,
                'recipient' => $invitation->email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function guardOwnerRoleNotInvited(array $roleIds): void
    {
        $ownerRoleId = Role::where('key', Role::OWNER)->value('id');
        if (in_array($ownerRoleId, $roleIds, true)) {
            throw new ApiException('CANNOT_MODIFY_OWNER', 403);
        }
    }
}
