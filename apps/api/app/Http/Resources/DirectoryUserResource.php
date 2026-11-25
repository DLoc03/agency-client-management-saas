<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Employee directory representation (docs/TEAM_CONTRACT.md section 5).
 * Since DEC-018 the per-agency fields (job title, phone, active flag,
 * roles) come from the user's membership in the current agency, which
 * the controller attaches as `directoryMembership`.
 */
class DirectoryUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $membership = $this->directoryMembership ?? null;

        return [
            'id' => $this->id,
            'membership_id' => $membership?->id,
            'name' => $this->name,
            'email' => $this->email,
            'job_title' => $membership?->job_title,
            'phone' => $membership?->phone,
            'locale' => $this->locale,
            'is_active' => $membership ? $membership->is_active : $this->is_active,
            'last_login_at' => $this->last_login_at,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map(fn ($role) => [
                'id' => $role->id,
                'key' => $role->key,
                'name' => $role->name,
            ])->values()),
            'teams' => $this->whenLoaded('teams', fn () => $this->teams->map(fn ($team) => [
                'id' => $team->id,
                'name' => $team->name,
            ])->values()),
            'open_tasks_count' => $this->when(
                isset($this->open_tasks_count),
                fn () => (int) $this->open_tasks_count
            ),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
