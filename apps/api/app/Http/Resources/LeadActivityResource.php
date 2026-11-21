<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadActivityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lead_id' => $this->lead_id,
            'lead' => $this->whenLoaded('lead', fn () => [
                'id' => $this->lead->id,
                'name' => $this->lead->name,
            ]),
            'type' => $this->type,
            'scheduled_at' => $this->scheduled_at?->toISOString(),
            'note' => $this->note,
            'is_done' => $this->is_done,
            'completed_at' => $this->completed_at?->toISOString(),
            'creator' => $this->whenLoaded('creator', fn () => [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ]),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
