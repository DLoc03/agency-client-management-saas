<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\StorePortalAccountRequest;
use App\Http\Requests\Clients\UpdatePortalAccountRequest;
use App\Http\Resources\PortalAccountResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Agency-side management of a client's Portal accounts
 * (docs/CLIENT_CONTRACT.md section 4). Authentication itself lives in
 * PortalAuthController (BE-003); this only creates and enables/disables.
 */
class ClientPortalAccountController extends Controller
{
    public function index(Client $client): AnonymousResourceCollection
    {
        return PortalAccountResource::collection($client->portalAccounts()->latest()->get());
    }

    public function store(StorePortalAccountRequest $request, Client $client): JsonResponse
    {
        $account = $client->portalAccounts()->create([
            ...$request->validated(),
            'agency_id' => $client->agency_id,
        ]);

        return PortalAccountResource::make($account)->response()->setStatusCode(201);
    }

    public function update(UpdatePortalAccountRequest $request, Client $client, int $accountId): PortalAccountResource
    {
        $account = $client->portalAccounts()->findOrFail($accountId);

        DB::transaction(function () use ($request, $account) {
            $account->update($request->validated());
            if (! $account->is_active) {
                // Disabling an account also revokes its live tokens.
                $account->tokens()->delete();
            }
        });

        return PortalAccountResource::make($account);
    }
}
