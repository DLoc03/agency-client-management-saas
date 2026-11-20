<?php

namespace App\Models\Concerns;

use App\Models\Agency;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Multi-tenancy scope (docs/AUTH_CONTRACT.md section 2).
 *
 * - Queries are automatically restricted to the agency of the currently
 *   authenticated internal user. Unauthenticated contexts (console, login,
 *   jobs without a user) are NOT scoped — code running there must scope
 *   explicitly when it handles tenant data.
 * - On create, agency_id is filled from the authenticated user when empty.
 */
trait BelongsToAgency
{
    /**
     * Re-entrancy guard: resolving the authenticated user can itself load a
     * tenant-scoped model (Sanctum loads the tokenable while authenticating).
     * While that resolution is in flight, nested scope invocations must not
     * try to resolve the user again.
     */
    private static bool $resolvingTenantUser = false;

    protected static function tenantUser(): ?User
    {
        if (static::$resolvingTenantUser) {
            return null;
        }

        static::$resolvingTenantUser = true;
        try {
            $user = auth()->user();
        } finally {
            static::$resolvingTenantUser = false;
        }

        return $user instanceof User ? $user : null;
    }

    protected static function bootBelongsToAgency(): void
    {
        static::addGlobalScope('agency', function (Builder $builder) {
            $user = static::tenantUser();
            if ($user && $user->agency_id) {
                $builder->where($builder->getModel()->getTable().'.agency_id', $user->agency_id);
            }
        });

        static::creating(function ($model) {
            if (empty($model->agency_id)) {
                $user = static::tenantUser();
                if ($user && $user->agency_id) {
                    $model->agency_id = $user->agency_id;
                }
            }
        });
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
