<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'milestone' => $this->whenLoaded('milestone', fn () => $this->milestone ? [
                'id' => $this->milestone->id,
                'name' => $this->milestone->name,
            ] : null),
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee ? [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
                'email' => $this->assignee->email,
            ] : null),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'name' => $this->project->name,
            ] : null),
            // DEC-027: whether the requesting user may act on this
            // task (same rule the API enforces) so the FE can gate
            // its controls. False without an authenticated app user
            // (e.g. Portal reads carry a client membership, which the
            // rule never privileges).
            'can_act' => $request->user() !== null && $this->canBeActedOnBy($request->user()),
            // Group 7 (DEC-028): Portal visibility flag for the
            // internal Client Portal section toggle.
            'client_visible' => (bool) $this->client_visible,
            'due_date' => $this->due_date?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'position' => $this->position,
            'checklist' => TaskChecklistItemResource::collection($this->whenLoaded('checklistItems')),
            'comments' => TaskCommentResource::collection($this->whenLoaded('comments')),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
