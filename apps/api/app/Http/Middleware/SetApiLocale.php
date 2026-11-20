<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Error/system messages follow the account locale (DEC-006):
 * authenticated account locale → Accept-Language → default `en`.
 */
class SetApiLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = null;
        $user = $request->user();
        if ($user && isset($user->locale)) {
            $locale = $user->locale;
        } elseif ($request->header('Accept-Language')) {
            $locale = substr($request->header('Accept-Language'), 0, 2);
        }

        if (! in_array($locale, ['en', 'vi'], true)) {
            $locale = 'en';
        }

        app()->setLocale($locale);

        return $next($request);
    }
}
