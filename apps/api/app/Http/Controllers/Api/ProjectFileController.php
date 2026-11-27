<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UploadProjectFileRequest;
use App\Http\Resources\ProjectFileResource;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Support\ProjectFileStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Internal side of project file sharing (docs/PORTAL_CONTRACT.md
 * section 3.2, DEC-028 Q10): staff see every file of a project they
 * can view — including hidden staff uploads and client uploads —
 * while uploading, toggling visibility and deleting require the
 * `portal.files.manage` permission (route middleware).
 */
class ProjectFileController extends Controller
{
    public function index(Request $request, Project $project): AnonymousResourceCollection
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $files = $project->portalFiles()
            ->with('uploader')
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return ProjectFileResource::collection($files);
    }

    public function store(UploadProjectFileRequest $request, Project $project): JsonResponse
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $file = ProjectFileStore::store(
            $request->file('file'),
            $project,
            $request->user(),
            ProjectFile::UPLOADER_STAFF,
            $request->validated('client_visible', true),
        );

        return ProjectFileResource::make($file->refresh()->load('uploader'))
            ->response()->setStatusCode(201);
    }

    public function update(Request $request, Project $project, int $fileId): ProjectFileResource
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $validated = $request->validate([
            'client_visible' => ['required', 'boolean'],
        ]);

        $file = $project->portalFiles()->findOrFail($fileId);
        $file->update($validated);

        return ProjectFileResource::make($file->refresh()->load('uploader'));
    }

    public function download(Request $request, Project $project, int $fileId): StreamedResponse
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $file = $project->portalFiles()->findOrFail($fileId);

        return Storage::disk(config('portal.files.disk'))
            ->download($file->stored_path, $file->original_name);
    }

    public function destroy(Request $request, Project $project, int $fileId): Response
    {
        abort_unless($project->isVisibleTo($request->user()), 404);

        $file = $project->portalFiles()->findOrFail($fileId);
        ProjectFileStore::delete($file);

        return response()->noContent();
    }
}
