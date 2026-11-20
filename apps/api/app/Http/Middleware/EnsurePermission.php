<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces RBAC permissions at the API layer (docs/RBAC_AND_I18N.md):
 * hiding a button in the UI is never a substitute for this check.
 * Usage: ->middleware('permission:clients.view')
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user || ! method_exists($user, 'hasPermission') || ! $user->hasPermission($permission)) {
            throw new AuthorizationException('Missing permission: '.$permission);
        }

        return $next($request);
    }
}
