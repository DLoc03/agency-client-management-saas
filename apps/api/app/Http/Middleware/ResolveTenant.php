<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\Membership;
use App\Support\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Establishes the tenant context for business routes (DEC-018,
 * design section 3.4). The tenant comes ONLY from the membership
 * bound to the presented token — any agency_id a client sends in a
 * body, query string or header is ignored by design.
 *
 * Membership validity is re-checked on EVERY request so a revocation
 * takes effect immediately, not at token expiry.
 */
class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $token = $user?->currentAccessToken();

        if (! $user || ! $token || ! $token->membership_id) {
            // Selection tokens (and any token without a membership)
            // may not touch business data.
            throw new ApiException('TENANT_CONTEXT_REQUIRED', 403);
        }

        // Bypass reason: Membership is itself tenant-scoped, and the
        // tenant context is exactly what this middleware establishes —
        // there is no context yet to scope by. This lookup is by the
        // token's own membership id, never by client input.
        $membership = Tenant::bypass(
            fn () => Membership::with('agency')->find($token->membership_id)
        );

        if (! $membership || $membership->user_id !== $user->id) {
            throw new ApiException('TENANT_CONTEXT_REQUIRED', 403);
        }

        if (! $membership->is_active) {
            $token->delete();
            throw new ApiException('MEMBERSHIP_INACTIVE', 403);
        }

        if ($membership->agency->is_locked) {
            throw new ApiException('AGENCY_LOCKED', 403);
        }

        Tenant::set($membership->agency_id, $membership);

        return $next($request);
    }
}
