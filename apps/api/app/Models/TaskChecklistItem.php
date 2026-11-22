<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One sub-checklist entry of a task (docs/PROJECT_CONTRACT.md). It has
 * no agency column of its own: tenancy is inherited through the task.
 */
class TaskChecklistItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['task_id', 'title', 'is_done', 'position'];

    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
            'position' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
