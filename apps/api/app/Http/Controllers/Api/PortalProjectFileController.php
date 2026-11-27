<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesPortalProject;
use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UploadProjectFileRequest;
use App\Http\Resources\ProjectFileResource;
use App\Models\ProjectFile;
use App\Support\ProjectFileStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Portal file sharing (docs/PORTAL_CONTRACT.md section 3.1,
 * DEC-028 Q3/Q4): the client lists and downloads the files shared
 * on their projects, uploads files for the agency, and may delete
 * files their own side uploaded. Staff files the agency chose to
 * hide are indistinguishable from missing ones (404).
 */
class PortalProjectFileController extends Controller
{
    use ResolvesPortalProject;

    public function index(Request $request, int $projectId): AnonymousResourceCollection
    {
        $project = $this->portalProject($projectId);

        $files = $project->portalFiles()
            ->with('uploader')
            ->where(fn ($q) => $q
                ->where('uploader_kind', ProjectFile::UPLOADER_CLIENT)
                ->orWhere('client_visible', true))
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return ProjectFileResource::collection($files);
    }

    public function store(UploadProjectFileRequest $request, int $projectId): JsonResponse
    {
        $project = $this->portalProject($projectId);

        // Client uploads are always visible to the agency; the
        // client_visible input only exists on the staff endpoint.
        $file = ProjectFileStore::store(
            $request->file('file'),
            $project,
            $request->user(),
            ProjectFile::UPLOADER_CLIENT,
        );

        return ProjectFileResource::make($file->refresh()->load('uploader'))
            ->response()->setStatusCode(201);
    }

    public function download(int $projectId, int $fileId): StreamedResponse
    {
        $project = $this->portalProject($projectId);
        $file = $project->portalFiles()->findOrFail($fileId);

        abort_unless($file->isVisibleToClient(), 404);

        return Storage::disk(config('portal.files.disk'))
            ->download($file->stored_path, $file->original_name);
    }

    public function destroy(int $projectId, int $fileId): Response
    {
        $project = $this->portalProject($projectId);
        $file = $project->portalFiles()->findOrFail($fileId);

        // The client side may only remove files its own side
        // uploaded; agency files are out of reach (404, as if the
        // delete surface did not exist for them).
        abort_unless($file->uploader_kind === ProjectFile::UPLOADER_CLIENT, 404);

        ProjectFileStore::delete($file);

        return response()->noContent();
    }
}
