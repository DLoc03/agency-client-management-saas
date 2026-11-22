<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** A simple project milestone (docs/PROJECT_CONTRACT.md). */
class Milestone extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const STATUS_PLANNED = 'planned';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUSES = [
        self::STATUS_PLANNED,
        self::STATUS_IN_PROGRESS,
        self::STATUS_COMPLETED,
    ];

    protected $fillable = [
        'agency_id', 'project_id', 'name', 'description', 'due_date', 'status',
    ];

    protected function casts(): array
    {
        return ['due_date' => 'date'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /** Done-task share of this milestone's tasks (0 tasks → 0). */
    public function progressPercent(): int
    {
        $total = $this->tasks_count ?? $this->tasks()->count();
        $done = $this->tasks_done_count ?? $this->tasks()->where('status', Task::STATUS_DONE)->count();

        return $total > 0 ? (int) round($done / $total * 100) : 0;
    }
}
