<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leads\StoreLeadNoteRequest;
use App\Http\Resources\LeadNoteResource;
use App\Models\Lead;
use App\Models\Role;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Internal lead notes. Never exposed to Portal accounts. */
class LeadNoteController extends Controller
{
    public function index(Request $request, Lead $lead): AnonymousResourceCollection
    {
        return LeadNoteResource::collection(
            $lead->notes()->with('author')->latest()->paginate(min($request->integer('per_page', 15), 100))
        );
    }

    public function store(StoreLeadNoteRequest $request, Lead $lead): JsonResponse
    {
        $note = $lead->notes()->create([
            'author_id' => $request->user()->id,
            'body' => $request->validated('body'),
        ]);

        // FIX-005 pattern: refresh for stored values, then load the author.
        return LeadNoteResource::make($note->refresh()->load('author'))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Lead $lead, int $noteId): Response
    {
        $note = $lead->notes()->findOrFail($noteId);
        $user = $request->user();

        // Only the author, the Owner or an Admin may delete a note.
        if ($note->author_id !== $user->id && ! $user->hasRole(Role::OWNER) && ! $user->hasRole(Role::ADMIN)) {
            throw new AuthorizationException('Only the author, the Owner or an Admin can delete this note.');
        }

        $note->delete();

        return response()->noContent();
    }
}
