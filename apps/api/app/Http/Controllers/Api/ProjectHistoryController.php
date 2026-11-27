<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Support\ProjectHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Internal side of the communication history (docs/
 * PORTAL_CONTRACT.md section 6): the same composed feed the client
 * sees — the exchange with the client, not an internal audit log.
 */
class ProjectHistoryController extends Controller
{
    public function show(Request $request, Project $project): JsonResponse
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        return response()->json(ProjectHistory::paginate(
            $project,
            max(1, $request->integer('page', 1)),
            min($request->integer('per_page', 15), 100),
        ));
    }
}
