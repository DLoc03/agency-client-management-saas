<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use App\Support\Tenant;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Tenant context lives on a container singleton so it resets
        // with the application (DEC-018).
        $this->app->singleton(Tenant::class, fn () => new Tenant);
    }

    public function boot(): void
    {
        // Tokens carry the DEC-018 tenant binding (agency + membership).
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // API-only backend: password reset links must point at the web app,
        // which collects the new password and calls the API (contract §3).
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            return rtrim(config('app.frontend_url'), '/').'/reset-password'
                .'?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });
    }
}
