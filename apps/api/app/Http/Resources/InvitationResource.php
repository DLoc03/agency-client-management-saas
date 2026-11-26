<?php

namespace App\Http\Resources;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Invitation representation (docs/TEAM_CONTRACT.md section 5). */
class InvitationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $roles = Role::whereIn('id', $this->role_ids ?? [])->get(['id', 'key', 'name']);

        return [
            'id' => $this->id,
            'email' => $this->email,
            'kind' => $this->kind,
            'client_id' => $this->client_id,
            'roles' => $roles->map(fn ($role) => [
                'id' => $role->id,
                'key' => $role->key,
                'name' => $role->name,
            ])->values(),
            'expires_at' => $this->expires_at,
            'invited_by' => $this->whenLoaded('inviter', fn () => $this->inviter ? [
                'id' => $this->inviter->id,
                'name' => $this->inviter->name,
            ] : null),
            'accepted_at' => $this->accepted_at,
            'revoked_at' => $this->revoked_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
