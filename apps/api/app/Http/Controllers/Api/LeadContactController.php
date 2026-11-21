<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leads\StoreLeadContactRequest;
use App\Http\Requests\Leads\UpdateLeadContactRequest;
use App\Http\Resources\ContactResource;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Contacts nested under a lead; a contact of another lead is a 404. */
class LeadContactController extends Controller
{
    public function index(Request $request, Lead $lead): AnonymousResourceCollection
    {
        return ContactResource::collection(
            $lead->contacts()->latest()->paginate(min($request->integer('per_page', 15), 100))
        );
    }

    public function store(StoreLeadContactRequest $request, Lead $lead): JsonResponse
    {
        $contact = $lead->contacts()->create($request->validated());

        // FIX-005 pattern: reload so column defaults (is_primary) show up.
        return ContactResource::make($contact->refresh())->response()->setStatusCode(201);
    }

    public function update(UpdateLeadContactRequest $request, Lead $lead, int $contactId): ContactResource
    {
        $contact = $lead->contacts()->findOrFail($contactId);
        $contact->update($request->validated());

        return ContactResource::make($contact);
    }

    public function destroy(Lead $lead, int $contactId): Response
    {
        $lead->contacts()->findOrFail($contactId)->delete();

        return response()->noContent();
    }
}
