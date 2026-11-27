<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A file shared on a project between the agency and the client
 * (docs/PORTAL_CONTRACT.md section 2.2, DEC-028). The physical file
 * lives on the private `local` disk; `stored_path` is internal only
 * and never appears in an API response — downloads always stream
 * through an authorized endpoint.
 */
class ProjectFile extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const UPLOADER_STAFF = 'staff';

    public const UPLOADER_CLIENT = 'client';

    protected $fillable = [
        'agency_id', 'project_id', 'uploaded_by', 'uploader_kind',
        'original_name', 'stored_path', 'mime_type', 'size_bytes',
        'client_visible',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'client_visible' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Whether a Portal account may see (and download) this file. */
    public function isVisibleToClient(): bool
    {
        return $this->uploader_kind === self::UPLOADER_CLIENT || $this->client_visible;
    }
}
