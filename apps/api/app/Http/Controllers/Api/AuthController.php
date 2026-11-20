<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\HandlesPasswordReset;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Internal authentication (contract: docs/AUTH_CONTRACT.md §3).
 * Tokens carry the `app` ability; portal tokens are rejected by middleware.
 */
class AuthController extends Controller
{
    use HandlesPasswordReset;

    protected function passwordBroker(): string
    {
        return 'users';
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::with(['roles', 'agency'])->where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw new ApiException('INVALID_CREDENTIALS', 401);
        }
        if (! $user->is_active) {
            throw new ApiException('ACCOUNT_DISABLED', 403);
        }
        if ($user->agency->is_locked) {
            throw new ApiException('AGENCY_LOCKED', 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('app', ['app'])->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => $this->userPayload($user),
                'agency' => $this->agencyPayload($user),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load(['roles', 'agency']);

        return response()->json([
            'data' => [
                'user' => $this->userPayload($user),
                'agency' => $this->agencyPayload($user),
            ],
        ]);
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

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'locale' => $user->locale,
            'roles' => $user->roleKeys(),
            'permissions' => $user->permissions(),
        ];
    }

    private function agencyPayload(User $user): array
    {
        return [
            'id' => $user->agency->id,
            'name' => $user->agency->name,
            'slug' => $user->agency->slug,
            'base_currency' => $user->agency->base_currency,
            'timezone' => $user->agency->timezone,
        ];
    }
}
