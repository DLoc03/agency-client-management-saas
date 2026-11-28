<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\HandlesPasswordReset;
use App\Http\Controllers\Api\Concerns\IssuesMembershipTokens;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\Membership;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Internal authentication (DEC-018; docs/AUTH_CONTRACT.md). One
 * identity, many memberships: login lands on the single/remembered
 * staff membership or returns a selection token + membership list.
 * Full tokens carry the `app` ability and are bound to a membership.
 */
class AuthController extends Controller
{
    use HandlesPasswordReset, IssuesMembershipTokens;

    protected function passwordBroker(): string
    {
        return 'users';
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = $this->authenticateIdentity($request);

        $data = $this->loginOutcome(
            $user,
            Membership::KIND_STAFF,
            fn (User $u, Membership $m, string $token) => $this->sessionPayload($u, $m, $token),
            $this->identityPayload($user),
        );

        return response()->json(['data' => $data]);
    }

    public function selectAgency(Request $request): JsonResponse
    {
        $data = $this->selectMembership(
            $request,
            Membership::KIND_STAFF,
            fn (User $u, Membership $m, string $token) => $this->sessionPayload($u, $m, $token),
        );

        return response()->json(['data' => $data]);
    }

    public function switchAgency(Request $request): JsonResponse
    {
        $data = $this->selectMembership(
            $request,
            null,
            fn (User $u, Membership $m, string $token) => $this->sessionPayload($u, $m, $token),
        );

        return response()->json(['data' => $data]);
    }

    public function memberships(Request $request): JsonResponse
    {
        $memberships = $this->activeMemberships($request->user());

        return response()->json([
            'data' => $memberships->map(fn (Membership $m) => $this->membershipPayload($m))->all(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $membership = Tenant::membership();

        return response()->json([
            'data' => [
                'user' => $this->identityPayload($user, $membership),
                'agency' => $this->agencyPayload($membership),
                'membership' => $this->membershipPayload($membership),
                'memberships' => $this->activeMemberships($user)
                    ->map(fn (Membership $m) => $this->membershipPayload($m))->all(),
            ],
        ]);
    }

    /**
     * Identity-level profile update (BE-013, DEC-031). Locale belongs
     * to the identity, not to any membership, so the route sits
     * outside the tenant middleware: it works through whichever
     * membership the token is bound to, and the stored locale then
     * drives SetApiLocale on every later request.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['locale' => $request->validated()['locale']])->save();

        return response()->json(['data' => $this->identityPayload($user)]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            throw new ApiException('CURRENT_PASSWORD_MISMATCH', 422);
        }

        $user->forceFill(['password' => Hash::make($request->new_password)])->save();

        // Revoke every other session; the current token stays valid (§6).
        $currentId = $user->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentId)->delete();

        return response()->json(['data' => ['changed' => true]]);
    }

    private function sessionPayload(User $user, Membership $membership, string $token): array
    {
        return [
            'token' => $token,
            'user' => $this->identityPayload($user, $membership),
            'agency' => $this->agencyPayload($membership),
            'membership' => $this->membershipPayload($membership),
        ];
    }

    private function identityPayload(User $user, ?Membership $membership = null): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'locale' => $user->locale,
            'roles' => $membership?->roleKeys() ?? [],
            'permissions' => $membership?->permissions() ?? [],
        ];
    }

    private function agencyPayload(Membership $membership): array
    {
        $agency = $membership->agency;

        return [
            'id' => $agency->id,
            'name' => $agency->name,
            'slug' => $agency->slug,
            'base_currency' => $agency->base_currency,
            'timezone' => $agency->timezone,
        ];
    }
}
