<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status,
            'client' => $this->whenLoaded('client', fn () => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->name,
            ] : null),
            'project_manager' => $this->whenLoaded('projectManager', fn () => $this->projectManager ? [
                'id' => $this->projectManager->id,
                'name' => $this->projectManager->name,
                'email' => $this->projectManager->email,
            ] : null),
            'start_date' => $this->start_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'budget' => $this->budget,
            'tasks_count' => $this->whenCounted('tasks'),
            'tasks_done_count' => $this->when(
                $this->tasks_done_count !== null || isset($this->tasks_done_count),
                fn () => $this->tasks_done_count !== null ? (int) $this->tasks_done_count : null
            ),
            'progress_percent' => $this->when(
                isset($this->tasks_count) || isset($this->tasks_done_count),
                fn () => $this->progressPercent()
            ),
            'milestones_count' => $this->whenCounted('milestones'),
            'members' => $this->whenLoaded('members', fn () => $this->members->map(fn ($member) => [
                'id' => $member->id,
                'name' => $member->name,
                'email' => $member->email,
            ])->values()),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
