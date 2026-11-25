<?php

namespace App\Models;

use App\Exceptions\ApiException;
use App\Models\Concerns\BelongsToAgency;
use App\Support\Tenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A person's relationship with one agency (DEC-018): kind `staff`
 * (internal member, holds roles) or kind `client` (Portal access,
 * bound to one client record). All access to an agency's data goes
 * through an active membership; tokens are bound to a membership.
 *
 * The model is itself tenant-scoped (Product Owner's addition to the
 * design): the only code allowed to read memberships before a tenant
 * context exists is ResolveTenant and the login/select/switch flows,
 * via explicit Tenant::bypass() with a stated reason.
 */
class Membership extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const KIND_STAFF = 'staff';

    public const KIND_CLIENT = 'client';

    protected $fillable = [
        'user_id',
        'agency_id',
        'kind',
        'client_id',
        'is_active',
        'job_title',
        'phone',
        'deactivated_at',
        'deactivated_by',
    ];

    protected static function booted(): void
    {
        // client_key mirrors client_id (0 when NULL) so the unique
        // index (agency_id, user_id, kind, client_key) also rejects
        // duplicate staff memberships, whose client_id is NULL.
        // Maintained here because InnoDB forbids an FK on a column
        // used by a generated column (see the migration).
        static::saving(function (Membership $membership) {
            $membership->client_key = $membership->client_id ?? 0;
        });
    }

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'deactivated_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'membership_role');
    }

    /** @return string[] */
    public function roleKeys(): array
    {
        return $this->roles->pluck('key')->all();
    }

    public function hasRole(string $key): bool
    {
        return $this->roles->contains('key', $key);
    }

    public function isOwner(): bool
    {
        return $this->kind === self::KIND_STAFF && $this->hasRole(Role::OWNER);
    }

    /**
     * Effective permission codes = union across the membership's roles
     * (DEC-005, moved from User to Membership by DEC-018). The Agency
     * Owner holds every permission.
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

    /** Tokens bound to this membership (sessions in this agency). */
    public function tokens()
    {
        return $this->hasMany(PersonalAccessToken::class, 'membership_id');
    }

    public function revokeTokens(): void
    {
        $this->tokens()->delete();
    }

    /**
     * Deactivate this membership and kill its sessions immediately
     * (design section 3.5): the current request of an affected session
     * finishes, the next one is rejected by ResolveTenant.
     */
    public function deactivate(?int $byUserId = null): void
    {
        $this->forceFill([
            'is_active' => false,
            'deactivated_at' => now(),
            'deactivated_by' => $byUserId,
        ])->save();

        $this->revokeTokens();
    }

    /**
     * Design rule Q3 (Product Owner): within one agency a person is
     * either staff or a client — never both. Throws 422
     * STAFF_CLIENT_MEMBERSHIP_CONFLICT when an ACTIVE membership of
     * the opposite kind exists in the same agency. Multiple client
     * memberships (different client_id) remain allowed.
     *
     * Must be called where memberships of the target agency are
     * visible: inside that agency's tenant context, or in bypass.
     */
    public static function ensureNoKindConflict(int $userId, int $agencyId, string $kind): void
    {
        $opposite = $kind === self::KIND_STAFF ? self::KIND_CLIENT : self::KIND_STAFF;

        $conflict = static::query()
            ->where('user_id', $userId)
            ->where('agency_id', $agencyId)
            ->where('kind', $opposite)
            ->where('is_active', true)
            ->exists();

        if ($conflict) {
            throw new ApiException('STAFF_CLIENT_MEMBERSHIP_CONFLICT', 422, ['field' => 'kind']);
        }
    }
}
