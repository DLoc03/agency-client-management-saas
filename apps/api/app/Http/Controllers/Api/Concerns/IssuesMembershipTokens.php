<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Exceptions\ApiException;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;

/**
 * Shared login / agency-selection logic for the internal app and the
 * Portal (DEC-018, design section 3). One identity, many memberships:
 * a login either lands directly on the single (or remembered)
 * membership, or returns a short-lived selection token plus the
 * membership list to choose from.
 */
trait IssuesMembershipTokens
{
    protected function authenticateIdentity(Request $request): User
    {
        $user = User::where('email', $request->input('email'))->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw new ApiException('INVALID_CREDENTIALS', 401);
        }
        if (! $user->is_active) {
            throw new ApiException('ACCOUNT_DISABLED', 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return $user;
    }

    /**
     * Active memberships of the identity, optionally of one kind.
     * Bypass reason: this runs in the login flow, before any tenant
     * context exists — memberships are loaded strictly for the
     * identity that just authenticated.
     */
    protected function activeMemberships(User $user, ?string $kind = null): Collection
    {
        return Tenant::bypass(fn () => $user->memberships()
            ->with(['agency', 'client', 'roles'])
            ->where('is_active', true)
            ->when($kind, fn ($q) => $q->where('kind', $kind))
            ->orderBy('id')
            ->get());
    }

    protected function membershipPayload(Membership $membership): array
    {
        return [
            'id' => $membership->id,
            'kind' => $membership->kind,
            'agency' => [
                'id' => $membership->agency->id,
                'name' => $membership->agency->name,
                'slug' => $membership->agency->slug,
                'base_currency' => $membership->agency->base_currency,
                'timezone' => $membership->agency->timezone,
            ],
            'client' => $membership->client ? [
                'id' => $membership->client->id,
                'name' => $membership->client->name,
            ] : null,
            'roles' => $membership->kind === Membership::KIND_STAFF ? $membership->roleKeys() : [],
        ];
    }

    protected function issueMembershipToken(User $user, Membership $membership): string
    {
        $ability = $membership->kind === Membership::KIND_CLIENT ? 'portal' : 'app';
        $newToken = $user->createToken($ability, [$ability]);
        $newToken->accessToken->forceFill([
            'agency_id' => $membership->agency_id,
            'membership_id' => $membership->id,
        ])->save();

        $user->forceFill(['last_membership_id' => $membership->id])->save();

        return $newToken->plainTextToken;
    }

    protected function issueSelectionToken(User $user): string
    {
        return $user->createToken('select', ['select'], now()->addMinutes(30))->plainTextToken;
    }

    /**
     * FIX-024 (DEC-030): a token whose only ability is `invitation`,
     * bound to no membership and no agency. ResolveTenant rejects it
     * on every tenant endpoint; its one useful call is accepting the
     * pending invitation (POST /invitations/accept), after which it
     * is deleted.
     */
    protected function issueInvitationToken(User $user): string
    {
        return $user->createToken('invitation', ['invitation'], now()->addMinutes(60))->plainTextToken;
    }

    /**
     * The earliest still-pending invitation addressed to this
     * identity on the given login surface (staff / portal), if any.
     * Bypass reason: this runs in the login flow, before any tenant
     * context exists — the lookup is strictly for the identity that
     * just authenticated (matched by user_id or by email) and only
     * decides whether an invitation-scoped token may be issued.
     */
    protected function pendingInvitationFor(User $user, ?string $membershipKind): ?Invitation
    {
        $invitationKind = match ($membershipKind) {
            Membership::KIND_STAFF => Invitation::KIND_STAFF,
            Membership::KIND_CLIENT => Invitation::KIND_CLIENT,
            default => null,
        };

        return Invitation::withoutGlobalScopes()
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->when($invitationKind, fn ($q) => $q->where('kind', $invitationKind))
            ->where(fn ($q) => $q->where('user_id', $user->id)
                ->orWhere('email', $user->email))
            ->orderBy('id')
            ->first();
    }

    /**
     * Decide the login outcome for an authenticated identity:
     * exactly one usable membership (or a remembered one) → full
     * token; several → selection token + list; none → 403.
     *
     * @param  callable(User, Membership, string): array  $shape  builds the `data` payload for the direct-token case
     */
    protected function loginOutcome(User $user, ?string $kind, callable $shape, array $identityPayload): array
    {
        $memberships = $this->activeMemberships($user, $kind);

        if ($memberships->isEmpty()) {
            // FIX-024 (DEC-030): an identity with no membership but a
            // pending invitation would otherwise dead-end here — it
            // could never sign in to accept the invitation. Give it a
            // scoped invitation token instead; with no pending
            // invitation the refusal is unchanged.
            $invitation = $this->pendingInvitationFor($user, $kind);
            if ($invitation) {
                $invitation->load('agency');

                return [
                    'invitation_only' => true,
                    'token' => $this->issueInvitationToken($user),
                    'identity' => $identityPayload,
                    'invitation' => [
                        'kind' => $invitation->kind,
                        'agency' => [
                            'id' => $invitation->agency->id,
                            'name' => $invitation->agency->name,
                        ],
                    ],
                ];
            }

            throw new ApiException('NO_ACTIVE_MEMBERSHIP', 403);
        }

        $chosen = null;
        if ($memberships->count() === 1) {
            $chosen = $memberships->first();
        } elseif ($user->last_membership_id) {
            $remembered = $memberships->firstWhere('id', $user->last_membership_id);
            if ($remembered && ! $remembered->agency->is_locked) {
                $chosen = $remembered;
            }
        }

        if ($chosen) {
            if ($chosen->agency->is_locked) {
                throw new ApiException('AGENCY_LOCKED', 403);
            }

            return $shape($user, $chosen, $this->issueMembershipToken($user, $chosen));
        }

        return [
            'selection_token' => $this->issueSelectionToken($user),
            'identity' => $identityPayload,
            'memberships' => $memberships->map(fn (Membership $m) => $this->membershipPayload($m))->all(),
        ];
    }

    /**
     * Shared select-agency / switch-agency implementation: the client
     * proposes a membership id, the server verifies it belongs to the
     * authenticated identity, is active, matches the surface kind and
     * its agency is not locked — then rotates the token.
     *
     * @param  callable(User, Membership, string): array  $shape
     */
    protected function selectMembership(Request $request, ?string $kind, callable $shape): array
    {
        $validated = $request->validate([
            'membership_id' => ['required', 'integer'],
        ]);

        $user = $request->user();

        // Bypass reason: select/switch runs before a tenant context
        // exists for the target agency; the membership is verified to
        // belong to the authenticated identity immediately below.
        $membership = Tenant::bypass(fn () => Membership::with(['agency', 'client', 'roles'])
            ->find($validated['membership_id']));

        if (! $membership || $membership->user_id !== $user->id
            || ($kind && $membership->kind !== $kind)) {
            throw new ApiException('NOT_FOUND', 404);
        }
        if (! $membership->is_active) {
            throw new ApiException('MEMBERSHIP_INACTIVE', 403);
        }
        if ($membership->agency->is_locked) {
            throw new ApiException('AGENCY_LOCKED', 403);
        }

        $user->currentAccessToken()->delete();

        return $shape($user, $membership, $this->issueMembershipToken($user, $membership));
    }
}
