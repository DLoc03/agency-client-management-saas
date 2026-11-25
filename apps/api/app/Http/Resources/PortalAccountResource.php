<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Portal access as seen by agency staff (DEC-018): the resource wraps
 * a client Membership; display fields come from the identity.
 * Never exposes credentials.
 */
class PortalAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'client_id' => $this->client_id,
            'name' => $this->user?->name,
            'email' => $this->user?->email,
            'locale' => $this->user?->locale,
            'is_active' => $this->is_active,
            'last_login_at' => $this->user?->last_login_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
