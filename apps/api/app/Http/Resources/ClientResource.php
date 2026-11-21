<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'status' => $this->status,
            'account_manager' => $this->whenLoaded('accountManager', fn () => $this->accountManager ? [
                'id' => $this->accountManager->id,
                'name' => $this->accountManager->name,
                'email' => $this->accountManager->email,
            ] : null),
            'source_lead_id' => $this->source_lead_id,
            'email' => $this->email,
            'phone' => $this->phone,
            'website' => $this->website,
            'address' => $this->address,
            'tax_code' => $this->tax_code,
            'organization' => OrganizationResource::make($this->whenLoaded('organization')),
            'contacts' => ContactResource::collection($this->whenLoaded('contacts')),
            'tags' => TagResource::collection($this->whenLoaded('tags')),
            'portal_accounts_count' => $this->whenCounted('portalAccounts'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
