<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MilestoneResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'name' => $this->name,
            'description' => $this->description,
            'due_date' => $this->due_date?->toDateString(),
            'status' => $this->status,
            'tasks_count' => $this->whenCounted('tasks'),
            'tasks_done_count' => $this->when(
                isset($this->tasks_done_count),
                fn () => (int) $this->tasks_done_count
            ),
            'progress_percent' => $this->when(
                isset($this->tasks_count) || isset($this->tasks_done_count),
                fn () => $this->progressPercent()
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
