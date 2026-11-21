<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\StoreContactRequest;
use App\Http\Requests\Clients\UpdateContactRequest;
use App\Http\Resources\ContactResource;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Contacts nested under a client; a contact of another client is a 404. */
class ClientContactController extends Controller
{
    public function index(Request $request, Client $client): AnonymousResourceCollection
    {
        return ContactResource::collection(
            $client->contacts()->latest()->paginate(min($request->integer('per_page', 15), 100))
        );
    }

    public function store(StoreContactRequest $request, Client $client): JsonResponse
    {
        $contact = $client->contacts()->create($request->validated());

        // FIX-005: reload so column defaults (is_primary) show up.
        return ContactResource::make($contact->refresh())->response()->setStatusCode(201);
    }

    public function update(UpdateContactRequest $request, Client $client, int $contactId): ContactResource
    {
        $contact = $client->contacts()->findOrFail($contactId);
        $contact->update($request->validated());

        return ContactResource::make($contact);
    }

    public function destroy(Client $client, int $contactId): Response
    {
        $client->contacts()->findOrFail($contactId)->delete();

        return response()->noContent();
    }
}
