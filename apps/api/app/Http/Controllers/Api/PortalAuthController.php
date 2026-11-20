<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\Concerns\HandlesPasswordReset;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\ClientAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Client Portal authentication (contract §3). Separate account type and
 * `portal` token ability — portal tokens cannot call internal endpoints.
 */
class PortalAuthController extends Controller
{
    use HandlesPasswordReset;

    protected function passwordBroker(): string
    {
        return 'clients';
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $account = ClientAccount::with('agency')->where('email', $request->email)->first();

        if (! $account || ! Hash::check($request->password, $account->password)) {
            throw new ApiException('INVALID_CREDENTIALS', 401);
        }
        if (! $account->is_active) {
            throw new ApiException('ACCOUNT_DISABLED', 403);
        }
        if ($account->agency->is_locked) {
            throw new ApiException('AGENCY_LOCKED', 403);
        }

        $account->forceFill(['last_login_at' => now()])->save();
        $token = $account->createToken('portal', ['portal'])->plainTextToken;

        return response()->json([
            'data' => [
                'token' => $token,
                'client' => [
                    'id' => $account->id,
                    'client_id' => $account->client_id,
                    'name' => $account->name,
                    'email' => $account->email,
                    'locale' => $account->locale,
                ],
                'agency' => [
                    'id' => $account->agency->id,
                    'name' => $account->agency->name,
                    'slug' => $account->agency->slug,
                ],
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
        $account = $request->user()->load('agency');

        return response()->json([
            'data' => [
                'client' => [
                    'id' => $account->id,
                    'client_id' => $account->client_id,
                    'name' => $account->name,
                    'email' => $account->email,
                    'locale' => $account->locale,
                ],
                'agency' => [
                    'id' => $account->agency->id,
                    'name' => $account->agency->name,
                    'slug' => $account->agency->slug,
                ],
            ],
        ]);
    }
}
