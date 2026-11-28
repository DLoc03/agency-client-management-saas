<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\HandlesPasswordReset;
use App\Http\Controllers\Api\Concerns\IssuesMembershipTokens;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\Membership;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Client Portal authentication (DEC-018). The Portal no longer has
 * its own account table: clients sign in with the same single
 * identity, and Portal access is a client membership. Portal tokens
 * carry the `portal` ability and are bound to that membership.
 */
class PortalAuthController extends Controller
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
            Membership::KIND_CLIENT,
            fn (User $u, Membership $m, string $token) => $this->sessionPayload($u, $m, $token),
            $this->identityPayload($user),
        );

        return response()->json(['data' => $data]);
    }

    public function selectAgency(Request $request): JsonResponse
    {
        $data = $this->selectMembership(
            $request,
            Membership::KIND_CLIENT,
            fn (User $u, Membership $m, string $token) => $this->sessionPayload($u, $m, $token),
        );

        return response()->json(['data' => $data]);
    }

    public function switchAgency(Request $request): JsonResponse
    {
        $data = $this->selectMembership(
            $request,
            Membership::KIND_CLIENT,
            fn (User $u, Membership $m, string $token) => $this->sessionPayload($u, $m, $token),
        );

        return response()->json(['data' => $data]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    /**
     * Identity-level profile update (BE-013, DEC-031) — Portal mirror
     * of the staff endpoint. Locale belongs to the identity, not to
     * any membership, so the route sits outside the tenant
     * middleware, exactly like the staff surface.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['locale' => $request->validated()['locale']])->save();

        return response()->json(['data' => $this->identityPayload($user)]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $membership = Tenant::membership();

        return response()->json([
            'data' => [
                'client' => $this->identityPayload($user, $membership),
                'agency' => [
                    'id' => $membership->agency->id,
                    'name' => $membership->agency->name,
                    'slug' => $membership->agency->slug,
                ],
                'membership' => $this->membershipPayload($membership),
            ],
        ]);
    }

    private function sessionPayload(User $user, Membership $membership, string $token): array
    {
        return [
            'token' => $token,
            'client' => $this->identityPayload($user, $membership),
            'agency' => [
                'id' => $membership->agency->id,
                'name' => $membership->agency->name,
                'slug' => $membership->agency->slug,
            ],
            'membership' => $this->membershipPayload($membership),
        ];
    }

    private function identityPayload(User $user, ?Membership $membership = null): array
    {
        return [
            'id' => $user->id,
            'client_id' => $membership?->client_id,
            'name' => $user->name,
            'email' => $user->email,
            'locale' => $user->locale,
        ];
    }
}
