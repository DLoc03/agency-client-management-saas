<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Auth\Authenticatable;
use Illuminate\Auth\MustVerifyEmail;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\Access\Authorizable as AuthorizableContract;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\Access\Authorizable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * Portal account for agency clients (DEC-005): a separate account TYPE,
 * not an internal role. Tokens issued to this model carry the `portal`
 * ability and can never call internal endpoints (and vice versa).
 */
class ClientAccount extends Model implements AuthenticatableContract, AuthorizableContract, CanResetPasswordContract
{
    use Authenticatable, Authorizable, BelongsToAgency, CanResetPassword, HasApiTokens, HasFactory, MustVerifyEmail, Notifiable, SoftDeletes;

    protected $fillable = [
        'agency_id', 'client_id', 'name', 'email', 'password', 'locale', 'is_active', 'last_login_at',
    ];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }
}
