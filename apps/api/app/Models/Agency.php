<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agency extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'slug', 'base_currency', 'timezone', 'is_locked',
        // Static payment details shown on invoices/PDFs (BE-008).
        'bank_name', 'bank_account_number', 'bank_account_holder', 'vietqr_payload',
    ];

    protected function casts(): array
    {
        return ['is_locked' => 'boolean'];
    }

    /** DEC-018: people belong to agencies through memberships. */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }
}
