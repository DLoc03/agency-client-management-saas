<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Exceptions\ApiException;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

/**
 * Shared forgot/reset password flow (contract §3). The reset link is
 * delivered by Laravel's default notification via the configured broker;
 * responses never reveal whether the account exists.
 */
trait HandlesPasswordReset
{
    abstract protected function passwordBroker(): string;

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        Password::broker($this->passwordBroker())->sendResetLink(
            $request->only('email')
        );

        return response()->json([
            'data' => ['message' => __('api.PASSWORD_RESET_SENT')],
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker($this->passwordBroker())->reset(
            $request->only('email', 'password', 'token'),
            function ($account, string $password) {
                $account->forceFill(['password' => Hash::make($password)])->save();
                $account->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw new ApiException('INVALID_RESET_TOKEN', 422);
        }

        return response()->json([
            'data' => ['message' => __('api.PASSWORD_RESET_DONE')],
        ]);
    }
}
