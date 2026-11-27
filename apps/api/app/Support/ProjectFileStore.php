<?php

namespace App\Support;

use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores an uploaded project file on the private disk and records
 * its metadata (docs/PORTAL_CONTRACT.md section 2.2). Shared by the
 * staff and Portal upload endpoints so both sides follow the same
 * layout: agency/project scoped path, unguessable file name, real
 * mime/size taken from the uploaded file itself.
 */
class ProjectFileStore
{
    public static function store(
        UploadedFile $file,
        Project $project,
        User $uploader,
        string $uploaderKind,
        bool $clientVisible = true,
    ): ProjectFile {
        $disk = Storage::disk(config('portal.files.disk'));
        $directory = 'agency-'.$project->agency_id.'/project-'.$project->id;
        $storedName = Str::uuid().'.'.strtolower($file->getClientOriginalExtension());

        $path = $disk->putFileAs($directory, $file, $storedName);

        return ProjectFile::create([
            'project_id' => $project->id,
            'uploaded_by' => $uploader->id,
            'uploader_kind' => $uploaderKind,
            'original_name' => $file->getClientOriginalName(),
            'stored_path' => $path,
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'client_visible' => $clientVisible,
        ]);
    }

    /** Soft-delete the record and remove the physical file. */
    public static function delete(ProjectFile $file): void
    {
        Storage::disk(config('portal.files.disk'))->delete($file->stored_path);
        $file->delete();
    }
}
