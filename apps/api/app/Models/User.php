<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'agency_id',
        'name',
        'email',
        'job_title',
        'phone',
        'locale',
        'password',
        'is_active',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function roleKeys(): array
    {
        return $this->roles->pluck('key')->all();
    }

    public function hasRole(string $key): bool
    {
        return $this->roles->contains('key', $key);
    }

    /** @param  string[]  $keys */
    public function hasAnyRole(array $keys): bool
    {
        return collect($keys)->contains(fn (string $key) => $this->hasRole($key));
    }

    /** Projects this user is a member of (docs/PROJECT_CONTRACT.md). */
    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(Team::class, 'team_user')->withTimestamps();
    }

    public function memberProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_members')->withTimestamps();
    }

    /** Tasks assigned to this user. */
    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function isOwner(): bool
    {
        return $this->hasRole(Role::OWNER);
    }

    /**
     * Effective permission codes = union across all held roles (DEC-005).
     * The Agency Owner holds every permission.
     */
    public function permissions(): array
    {
        if ($this->isOwner()) {
            return config('rbac.permissions');
        }

        $permissions = [];
        foreach ($this->roleKeys() as $key) {
            foreach (config("rbac.roles.$key", []) as $permission) {
                $permissions[$permission] = true;
            }
        }

        return array_keys($permissions);
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
