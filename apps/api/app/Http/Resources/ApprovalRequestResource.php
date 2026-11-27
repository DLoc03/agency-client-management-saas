<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A client approval request on a project (Group 7). */
class ApprovalRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'file_id' => $this->file_id,
            'milestone_id' => $this->milestone_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'response_comment' => $this->response_comment,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null),
            'responded_by' => $this->whenLoaded('responder', fn () => $this->responder ? [
                'id' => $this->responder->id,
                'name' => $this->responder->name,
            ] : null),
            'responded_at' => $this->responded_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
