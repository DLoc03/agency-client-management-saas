<?php

namespace App\Models\Concerns;

use App\Exceptions\TenantContextMissing;
use App\Models\Agency;
use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Multi-tenancy scope, version 2 (DEC-018, design section 4).
 *
 * - The tenant comes from the Tenant context (the membership bound
 *   to the current token), never from client input.
 * - FAIL-CLOSED: with no context and no explicit Tenant::bypass(),
 *   any query or create throws TenantContextMissing instead of
 *   silently running unscoped (the v1 behaviour).
 * - On create, agency_id is filled from the context when empty.
 */
trait BelongsToAgency
{
    protected static function bootBelongsToAgency(): void
    {
        static::addGlobalScope('agency', function (Builder $builder) {
            if (Tenant::isBypassed()) {
                return;
            }

            $agencyId = Tenant::id();
            if (! $agencyId) {
                throw new TenantContextMissing(static::class);
            }

            $builder->where($builder->getModel()->getTable().'.agency_id', $agencyId);
        });

        static::creating(function ($model) {
            if (! empty($model->agency_id)) {
                return;
            }
            if (Tenant::isBypassed()) {
                return;
            }

            $agencyId = Tenant::id();
            if (! $agencyId) {
                throw new TenantContextMissing(static::class);
            }

            $model->agency_id = $agencyId;
        });
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
