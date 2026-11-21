<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\StoreClientRequest;
use App\Http\Requests\Clients\UpdateClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Client management, internal side (docs/CLIENT_CONTRACT.md).
 * Permissions are enforced by route middleware; tenancy by the
 * BelongsToAgency scope (cross-agency ids resolve to 404).
 */
class ClientController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $clients = Client::query()
            ->with(['tags', 'accountManager'])
            ->withCount('portalAccounts')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('account_manager_id'), fn ($q) => $q->where('account_manager_id', $request->integer('account_manager_id')))
            ->when($request->filled('tag_id'), fn ($q) => $q->whereHas('tags', fn ($t) => $t->where('tags.id', $request->integer('tag_id'))))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%'.$request->string('q').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $term)->orWhere('email', 'like', $term));
            })
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return ClientResource::collection($clients);
    }

    public function store(StoreClientRequest $request): JsonResponse
    {
        $client = DB::transaction(function () use ($request) {
            $client = Client::create($request->clientAttributes());

            if ($client->type === Client::TYPE_COMPANY && $request->has('organization')) {
                $client->organization()->create($request->input('organization'));
            }
            if ($request->has('tag_ids')) {
                $client->tags()->sync($request->input('tag_ids', []));
            }

            return $client;
        });

        // FIX-005: reload so column defaults (status, type) are reflected
        // in the response instead of the in-memory nulls.
        $client->refresh();

        return ClientResource::make(
            $client->load(['organization', 'tags', 'accountManager'])->loadCount('portalAccounts')
        )->response()->setStatusCode(201);
    }

    public function show(Client $client): ClientResource
    {
        return ClientResource::make(
            $client->load(['organization', 'contacts', 'tags', 'accountManager'])->loadCount('portalAccounts')
        );
    }

    public function update(UpdateClientRequest $request, Client $client): ClientResource
    {
        DB::transaction(function () use ($request, $client) {
            $client->update($request->clientAttributes());

            if ($client->type === Client::TYPE_COMPANY && $request->has('organization')) {
                $client->organization()->updateOrCreate([], $request->input('organization'));
            }
            if ($request->has('tag_ids')) {
                $client->tags()->sync($request->input('tag_ids', []));
            }
        });

        return ClientResource::make(
            $client->load(['organization', 'tags', 'accountManager'])->loadCount('portalAccounts')
        );
    }

    public function destroy(Client $client): Response
    {
        DB::transaction(function () use ($client) {
            // DEC-009.4: deleting a client disables its Portal accounts
            // (and revokes their tokens) instead of orphaning them.
            $client->portalAccounts()->each(function ($account) {
                $account->tokens()->delete();
                $account->update(['is_active' => false]);
            });
            $client->delete();
        });

        return response()->noContent();
    }
}
