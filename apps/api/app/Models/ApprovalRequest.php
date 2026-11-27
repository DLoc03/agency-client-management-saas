<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A simple client approval request on a project (docs/
 * PORTAL_CONTRACT.md section 2.4, DEC-028): the agency asks the
 * client to approve a file, a milestone or a written hand-over. A
 * request is answered exactly once — the first response wins and the
 * record is immutable afterwards; asking again means a new request.
 */
class ApprovalRequest extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_CHANGES_REQUESTED = 'changes_requested';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_CHANGES_REQUESTED,
    ];

    /** Decisions a client may send when responding. */
    public const DECISIONS = [
        self::STATUS_APPROVED,
        self::STATUS_CHANGES_REQUESTED,
    ];

    protected $fillable = [
        'agency_id', 'project_id', 'file_id', 'milestone_id', 'title',
        'description', 'created_by', 'status', 'response_comment',
        'responded_by', 'responded_at',
    ];

    protected function casts(): array
    {
        return ['responded_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(ProjectFile::class, 'file_id');
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(Milestone::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by');
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }
}
