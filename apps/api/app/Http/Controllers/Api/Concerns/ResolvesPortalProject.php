<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Project;
use App\Support\Tenant;

/**
 * Resolves a project inside the Portal scope (docs/
 * PORTAL_CONTRACT.md section 4): pinned to the client record of the
 * membership bound to the token, with draft/cancelled projects
 * hidden (DEC-028 Q2). Anything outside the scope is a 404, exactly
 * like the Portal project view itself.
 */
trait ResolvesPortalProject
{
    protected function portalProject(int $projectId): Project
    {
        return Project::query()
            ->where('client_id', Tenant::membership()->client_id)
            ->whereNotIn('status', [Project::STATUS_DRAFT, Project::STATUS_CANCELLED])
            ->findOrFail($projectId);
    }
}
