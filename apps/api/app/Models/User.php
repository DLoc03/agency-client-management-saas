<?php

namespace App\Models;

use App\Support\Tenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * The single identity of a person (DEC-018): one email, one password,
 * usable in every agency they hold a membership in — as staff, as a
 * Portal client, or both (in different agencies). Agency-specific
 * facts (roles, job title, phone) live on Membership, not here.
 */
class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'locale',
        'password',
        'is_active',
        'last_login_at',
        'last_membership_id',
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

    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    public function lastMembership(): BelongsTo
    {
        return $this->belongsTo(Membership::class, 'last_membership_id');
    }

    /**
     * This user's membership in a specific agency, if any. Membership
     * is tenant-scoped, so callers must be in that agency's context or
     * in an explicit bypass (login flows, ResolveTenant).
     */
    public function membershipIn(int $agencyId): ?Membership
    {
        return $this->memberships()->where('agency_id', $agencyId)->first();
    }

    /**
     * Whether this identity holds an ACTIVE membership of the given
     * kind in the given agency — the DEC-018 replacement for the old
     * `$user->agency_id` comparisons in form requests.
     */
    public function hasActiveMembershipIn(int $agencyId, string $kind = Membership::KIND_STAFF): bool
    {
        // Bypass reason: the check names its agency explicitly and
        // must work whatever the current tenant context is.
        return Tenant::bypass(fn () => Membership::query()
            ->where('user_id', $this->id)
            ->where('agency_id', $agencyId)
            ->where('kind', $kind)
            ->where('is_active', true)
            ->exists());
    }

    /**
     * The membership this request is working through — set by
     * ResolveTenant from the token. Role/permission helpers below
     * delegate to it so existing call sites keep their meaning
     * ("the current user's role IN THIS AGENCY").
     */
    public function currentMembership(): ?Membership
    {
        $membership = Tenant::membership();

        return $membership && $membership->user_id === $this->id ? $membership : null;
    }

    /** @return string[] */
    public function roleKeys(): array
    {
        return $this->currentMembership()?->roleKeys() ?? [];
    }

    public function hasRole(string $key): bool
    {
        return $this->currentMembership()?->hasRole($key) ?? false;
    }

    /** @param  string[]  $keys */
    public function hasAnyRole(array $keys): bool
    {
        return collect($keys)->contains(fn (string $key) => $this->hasRole($key));
    }

    public function isOwner(): bool
    {
        return $this->currentMembership()?->isOwner() ?? false;
    }

    public function permissions(): array
    {
        return $this->currentMembership()?->permissions() ?? [];
    }

    public function hasPermission(string $permission): bool
    {
        return $this->currentMembership()?->hasPermission($permission) ?? false;
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
}
