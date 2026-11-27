<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A unit of project work (docs/PROJECT_CONTRACT.md). `completed_at`
 * follows the status automatically: set when the task enters `done`,
 * cleared when it leaves.
 */
class Task extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const STATUS_TODO = 'todo';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_IN_REVIEW = 'in_review';

    public const STATUS_DONE = 'done';

    public const STATUSES = [
        self::STATUS_TODO,
        self::STATUS_IN_PROGRESS,
        self::STATUS_IN_REVIEW,
        self::STATUS_DONE,
    ];

    public const PRIORITY_LOW = 'low';

    public const PRIORITY_MEDIUM = 'medium';

    public const PRIORITY_HIGH = 'high';

    public const PRIORITY_URGENT = 'urgent';

    public const PRIORITIES = [
        self::PRIORITY_LOW,
        self::PRIORITY_MEDIUM,
        self::PRIORITY_HIGH,
        self::PRIORITY_URGENT,
    ];

    protected $fillable = [
        'agency_id', 'project_id', 'milestone_id', 'title', 'description',
        'status', 'priority', 'assignee_id', 'created_by', 'due_date', 'completed_at', 'position',
        'client_visible',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'datetime',
            'completed_at' => 'datetime',
            'position' => 'integer',
            'client_visible' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Task $task) {
            if ($task->isDirty('status')) {
                $task->completed_at = $task->status === self::STATUS_DONE ? now() : null;
            }
        });
    }

    /**
     * Who may ACT on this task (DEC-027): the assignee, the project's
     * manager, or a user whose CURRENT membership (DEC-018: roles live
     * on the membership) is the Owner or holds the Admin / Project
     * Manager role. Viewing a task follows Project::isVisibleTo()
     * instead — this rule guards mutations only (update, delete,
     * comments, checklist). Portal (client) memberships hold none of
     * these, so the answer is naturally false for Portal readers.
     */
    public function canBeActedOnBy(User $user): bool
    {
        if ($this->assignee_id === $user->id) {
            return true;
        }

        $managerId = $this->relationLoaded('project')
            ? $this->project?->project_manager_id
            : Project::whereKey($this->project_id)->value('project_manager_id');

        if ($managerId !== null && (int) $managerId === $user->id) {
            return true;
        }

        $membership = $user->currentMembership();

        return $membership !== null
            && ($membership->isOwner()
                || $membership->hasRole(Role::ADMIN)
                || $membership->hasRole(Role::PROJECT_MANAGER));
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(Milestone::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /** Who created the task (BE-009 notification recipient rule). */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }

    public function checklistItems(): HasMany
    {
        return $this->hasMany(TaskChecklistItem::class);
    }
}
