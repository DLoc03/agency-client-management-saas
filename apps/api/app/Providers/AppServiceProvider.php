<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // API-only backend: password reset links must point at the web app,
        // which collects the new password and calls the API (contract §3).
        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            return rtrim(config('app.frontend_url'), '/').'/reset-password'
                .'?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });
    }
}
