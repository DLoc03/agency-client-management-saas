<?php

namespace App\Support;

use App\Models\Membership;

/**
 * The tenant context of the code currently running (DEC-018, design
 * section 4). State is held on a container-bound instance so every
 * application rebuild (each test, each request) starts empty.
 *
 * Fail-closed rule: tenant-scoped models refuse to run when there is
 * no context and the caller is not inside an explicit bypass. Code
 * that legitimately works outside a tenant must say so:
 *
 *   Tenant::run($agencyId, fn () => ...)   // jobs, console, seeders
 *   Tenant::bypass(fn () => ...)           // Super Admin, login flows,
 *                                          // ResolveTenant itself
 *
 * Every bypass() call site must carry a comment stating the reason
 * (AGENTS.md tenant rules).
 */
class Tenant
{
    private ?int $agencyId = null;

    private ?Membership $membership = null;

    private int $bypassDepth = 0;

    private static function context(): static
    {
        return app(static::class);
    }

    public static function set(?int $agencyId, ?Membership $membership = null): void
    {
        $context = static::context();
        $context->agencyId = $agencyId;
        $context->membership = $membership;
    }

    public static function clear(): void
    {
        static::set(null, null);
    }

    public static function id(): ?int
    {
        return static::context()->agencyId;
    }

    public static function membership(): ?Membership
    {
        return static::context()->membership;
    }

    public static function isBypassed(): bool
    {
        return static::context()->bypassDepth > 0;
    }

    /**
     * Run $callback inside the tenant of the given agency, restoring
     * the previous context afterwards. The membership is resolved
     * lazily by callers that need it; the scope only needs the id.
     */
    public static function run(int $agencyId, callable $callback): mixed
    {
        $context = static::context();
        $previousAgency = $context->agencyId;
        $previousMembership = $context->membership;

        $context->agencyId = $agencyId;
        $context->membership = null;

        try {
            return $callback();
        } finally {
            $context->agencyId = $previousAgency;
            $context->membership = $previousMembership;
        }
    }

    /**
     * Run $callback explicitly outside any tenant. Only for code that
     * is tenant-agnostic by design and says why at the call site.
     */
    public static function bypass(callable $callback): mixed
    {
        $context = static::context();
        $context->bypassDepth++;

        try {
            return $callback();
        } finally {
            $context->bypassDepth--;
        }
    }
}
