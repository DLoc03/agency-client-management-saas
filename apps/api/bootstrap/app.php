<?php

use App\Exceptions\ApiException;
use App\Exceptions\TenantContextMissing;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\ResolveTenant;
use App\Http\Middleware\SetApiLocale;
use App\Support\ApiError;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'ability' => CheckAbilities::class,
            'abilities' => CheckForAnyAbility::class,
            'permission' => EnsurePermission::class,
            'tenant' => ResolveTenant::class,
        ]);
        $middleware->api(append: [SetApiLocale::class]);

        // DEC-018: ResolveTenant must run right after authentication
        // and BEFORE SubstituteBindings, because implicit route-model
        // binding already queries tenant-scoped models.
        $middleware->appendToPriorityList(AuthenticatesRequests::class, ResolveTenant::class);

        // API-only backend: there is no web `login` route to redirect guests
        // to. Laravel's default guest redirect calls route('login') eagerly
        // inside the Authenticate middleware, which turned a revoked token
        // into a 500 instead of 401 for non-JSON clients (QA-002, FIX-002).
        // Returning null lets the exception handler answer 401 JSON instead
        // (see shouldRenderJsonWhen below).
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // API clients must always get JSON, whatever Accept header they send.
        // Without this, an unauthenticated non-JSON request makes the auth
        // middleware redirect to a named `login` route that does not exist in
        // this API-only app — a 500 instead of 401 (QA-002 finding, FIX-002).
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        // Standard API error format for all /api responses (contract §4).
        $exceptions->render(function (ApiException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond($e->errorCode, $e->status, $e->details);
            }
        });
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('VALIDATION_FAILED', 422, $e->errors());
            }
        });
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('UNAUTHENTICATED', 401);
            }
        });
        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('FORBIDDEN', 403);
            }
        });
        // The exception handler converts AuthorizationException (including
        // Sanctum's MissingAbilityException) into AccessDeniedHttpException
        // before render callbacks run — map it to the same standard format.
        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('FORBIDDEN', 403);
            }
        });
        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('NOT_FOUND', 404);
            }
        });
        // A missing tenant context is a programming error (DEC-018
        // fail-closed), surfaced as a 500 so it is impossible to miss.
        $exceptions->render(function (TenantContextMissing $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('TENANT_CONTEXT_MISSING', 500);
            }
        });
        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('RATE_LIMITED', 429);
            }
        });
    })->create();
