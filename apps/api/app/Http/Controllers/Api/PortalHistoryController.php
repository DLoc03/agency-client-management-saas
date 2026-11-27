<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesPortalProject;
use App\Http\Controllers\Controller;
use App\Support\ProjectHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Portal side of the communication history (docs/PORTAL_CONTRACT.md
 * section 6): the composed feed of thread comments, approval events
 * and public invoice events for one of the client's own projects.
 */
class PortalHistoryController extends Controller
{
    use ResolvesPortalProject;

    public function show(Request $request, int $projectId): JsonResponse
    {
        $project = $this->portalProject($projectId);

        return response()->json(ProjectHistory::paginate(
            $project,
            max(1, $request->integer('page', 1)),
            min($request->integer('per_page', 15), 100),
        ));
    }
}
