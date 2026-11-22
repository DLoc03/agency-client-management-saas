<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Client-facing view of a project (docs/PROJECT_CONTRACT.md section 5):
 * progress and deliverables only — no budget, no internal comments,
 * no internal user details beyond display names.
 */
class PortalProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status,
            'start_date' => $this->start_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'tasks_count' => $this->whenCounted('tasks'),
            'tasks_done_count' => $this->when(
                isset($this->tasks_done_count),
                fn () => (int) $this->tasks_done_count
            ),
            'progress_percent' => $this->when(
                isset($this->tasks_count) || isset($this->tasks_done_count),
                fn () => $this->progressPercent()
            ),
            'milestones' => $this->whenLoaded('milestones', fn () => $this->milestones->map(fn ($milestone) => [
                'id' => $milestone->id,
                'name' => $milestone->name,
                'due_date' => $milestone->due_date?->toDateString(),
                'status' => $milestone->status,
                'progress_percent' => $milestone->progressPercent(),
            ])->values()),
            'tasks' => $this->whenLoaded('tasks', fn () => $this->tasks->map(fn ($task) => [
                'id' => $task->id,
                'title' => $task->title,
                'status' => $task->status,
                'priority' => $task->priority,
                'due_date' => $task->due_date?->toISOString(),
                'completed_at' => $task->completed_at?->toISOString(),
            ])->values()),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
