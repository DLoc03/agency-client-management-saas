<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agency extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = ['name', 'slug', 'base_currency', 'timezone', 'is_locked'];

    protected function casts(): array
    {
        return ['is_locked' => 'boolean'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function clientAccounts(): HasMany
    {
        return $this->hasMany(ClientAccount::class);
    }
}
