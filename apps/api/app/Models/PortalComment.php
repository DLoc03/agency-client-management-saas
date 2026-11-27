<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One message in a project's Portal discussion thread
 * (docs/PORTAL_CONTRACT.md section 2.3, DEC-028). Deliberately a
 * separate table from the internal task_comments: task comments are
 * never exposed to the Portal, so the exposure boundary lives in the
 * data layer rather than in display filtering.
 */
class PortalComment extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const AUTHOR_STAFF = 'staff';

    public const AUTHOR_CLIENT = 'client';

    protected $fillable = [
        'agency_id', 'project_id', 'author_id', 'author_kind', 'body',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
