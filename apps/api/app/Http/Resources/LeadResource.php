<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'company_name' => $this->company_name,
            'contact_name' => $this->contact_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'source' => $this->source,
            'status' => $this->status,
            'estimated_value' => $this->estimated_value,
            'owner' => $this->whenLoaded('owner', fn () => $this->owner ? [
                'id' => $this->owner->id,
                'name' => $this->owner->name,
                'email' => $this->owner->email,
            ] : null),
            'unqualified_reason' => $this->unqualified_reason,
            'converted_client_id' => $this->converted_client_id,
            'converted_at' => $this->converted_at?->toISOString(),
            'last_contacted_at' => $this->last_contacted_at?->toISOString(),
            'contacts' => ContactResource::collection($this->whenLoaded('contacts')),
            'notes_count' => $this->whenCounted('notes'),
            'activities_count' => $this->whenCounted('activities'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
