<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\SetApiLocale;
use App\Support\ApiError;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
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
        ]);
        $middleware->api(append: [SetApiLocale::class]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
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
        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return ApiError::respond('RATE_LIMITED', 429);
            }
        });
    })->create();
