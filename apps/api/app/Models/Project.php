<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A client project (docs/PROJECT_CONTRACT.md). Next link of the core
 * flow Lead → Client → Project → Task → Invoice. Progress is derived
 * from tasks at read time, never stored.
 */
class Project extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_ON_HOLD = 'on_hold';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_IN_PROGRESS,
        self::STATUS_ON_HOLD,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'agency_id', 'client_id', 'name', 'description', 'status',
        'project_manager_id', 'start_date', 'due_date', 'budget',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'due_date' => 'date',
            'budget' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function projectManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'project_manager_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members')->withPivot('via_team_id')->withTimestamps();
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(Milestone::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /** Done-task share of all tasks, as a whole percent (0 tasks → 0). */
    public function progressPercent(): int
    {
        $total = $this->tasks_count ?? $this->tasks()->count();
        $done = $this->tasks_done_count ?? $this->tasks()->where('status', Task::STATUS_DONE)->count();

        return $total > 0 ? (int) round($done / $total * 100) : 0;
    }

    /**
     * Team Member visibility (DEC-016 matrix): a user whose only view
     * access comes from the Team Member role sees just the projects
     * they participate in — as a member or via an assigned task.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if (! $user->hasRole(Role::TEAM_MEMBER)
            || $user->hasAnyRole([Role::OWNER, Role::ADMIN, Role::SALES_MANAGER, Role::PROJECT_MANAGER, Role::ACCOUNTANT])) {
            return $query;
        }

        return $query->where(function (Builder $q) use ($user) {
            $q->whereHas('members', fn (Builder $m) => $m->where('users.id', $user->id))
                ->orWhereHas('tasks', fn (Builder $t) => $t->where('assignee_id', $user->id));
        });
    }

    /** Whether the given user participates in this project (see scopeVisibleTo). */
    public function isVisibleTo(User $user): bool
    {
        return static::query()->visibleTo($user)->whereKey($this->id)->exists();
    }
}
