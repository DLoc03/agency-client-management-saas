<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\StorePortalAccountRequest;
use App\Http\Requests\Clients\UpdatePortalAccountRequest;
use App\Http\Resources\PortalAccountResource;
use App\Models\Client;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Agency-side management of a client's Portal access
 * (docs/CLIENT_CONTRACT.md section 4, reworked by DEC-018).
 *
 * Portal access is a client Membership on the person's single
 * identity: if the email already has an identity, access is granted
 * to that identity (no second password); a brand-new email creates
 * the identity with the agency-provided initial password — the
 * invitation-link flow that replaces this arrives with BE-010.
 * Authentication itself lives in PortalAuthController.
 */
class ClientPortalAccountController extends Controller
{
    public function index(Client $client): AnonymousResourceCollection
    {
        $memberships = $client->portalAccounts()->with('user')->latest()->get();

        return PortalAccountResource::collection($memberships);
    }

    public function store(StorePortalAccountRequest $request, Client $client): JsonResponse
    {
        $validated = $request->validated();
        $email = Str::lower($validated['email']);

        $membership = DB::transaction(function () use ($validated, $email, $client) {
            $identity = User::where('email', $email)->first();

            if ($identity) {
                // Design rule Q3: never both staff and client here.
                Membership::ensureNoKindConflict($identity->id, $client->agency_id, Membership::KIND_CLIENT);

                $existing = Membership::where('user_id', $identity->id)
                    ->where('agency_id', $client->agency_id)
                    ->where('kind', Membership::KIND_CLIENT)
                    ->where('client_id', $client->id)
                    ->first();
                if ($existing) {
                    if ($existing->is_active) {
                        throw new ApiException('EMAIL_ALREADY_REGISTERED', 422);
                    }
                    $existing->forceFill([
                        'is_active' => true,
                        'deactivated_at' => null,
                        'deactivated_by' => null,
                    ])->save();

                    return $existing;
                }
            } else {
                $identity = User::create([
                    'name' => $validated['name'],
                    'email' => $email,
                    'password' => $validated['password'],
                    'locale' => $validated['locale'] ?? 'en',
                    'is_active' => true,
                ]);
            }

            return Membership::create([
                'user_id' => $identity->id,
                'agency_id' => $client->agency_id,
                'kind' => Membership::KIND_CLIENT,
                'client_id' => $client->id,
                'is_active' => true,
            ]);
        });

        $membership->load('user');

        return PortalAccountResource::make($membership->refresh())
            ->response()->setStatusCode(201);
    }

    public function update(UpdatePortalAccountRequest $request, Client $client, int $accountId): PortalAccountResource
    {
        $membership = $client->portalAccounts()->findOrFail($accountId);
        $isActive = $request->validated('is_active');

        if ($isActive === false) {
            // Deactivation also revokes the membership's live tokens.
            $membership->deactivate($request->user()->id);
        } elseif ($isActive === true) {
            $membership->forceFill([
                'is_active' => true,
                'deactivated_at' => null,
                'deactivated_by' => null,
            ])->save();
        }

        $membership->load('user');

        return PortalAccountResource::make($membership);
    }
}
