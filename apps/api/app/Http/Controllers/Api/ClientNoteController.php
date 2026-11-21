<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\StoreClientNoteRequest;
use App\Http\Resources\ClientNoteResource;
use App\Models\Client;
use App\Models\Role;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** Internal client notes. Never exposed to Portal accounts. */
class ClientNoteController extends Controller
{
    public function index(Request $request, Client $client): AnonymousResourceCollection
    {
        return ClientNoteResource::collection(
            $client->notes()->with('author')->latest()->paginate(min($request->integer('per_page', 15), 100))
        );
    }

    public function store(StoreClientNoteRequest $request, Client $client): JsonResponse
    {
        $note = $client->notes()->create([
            'author_id' => $request->user()->id,
            'body' => $request->validated('body'),
        ]);

        // FIX-005: refresh for stored values, then load the author relation.
        return ClientNoteResource::make($note->refresh()->load('author'))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, Client $client, int $noteId): Response
    {
        $note = $client->notes()->findOrFail($noteId);
        $user = $request->user();

        // Only the author, the Owner or an Admin may delete a note.
        if ($note->author_id !== $user->id && ! $user->hasRole(Role::OWNER) && ! $user->hasRole(Role::ADMIN)) {
            throw new AuthorizationException('Only the author, the Owner or an Admin can delete this note.');
        }

        $note->delete();

        return response()->noContent();
    }
}
