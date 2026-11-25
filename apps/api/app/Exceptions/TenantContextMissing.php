<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when tenant-scoped code runs without a tenant context and
 * without an explicit Tenant::bypass() (DEC-018 fail-closed rule).
 * This is always a programming error, never a client error — it is
 * rendered as a 500 so it surfaces loudly in logs and tests.
 */
class TenantContextMissing extends RuntimeException
{
    public function __construct(string $model)
    {
        parent::__construct(
            "Tenant context missing while using {$model}. ".
            'Set the context via ResolveTenant (HTTP), Tenant::run() (jobs/console/seeders) '.
            'or Tenant::bypass() (explicitly tenant-agnostic code).'
        );
    }
}
