<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A pending workspace invitation (docs/TEAM_CONTRACT.md section 2).
 * Only the SHA-256 hash of the accept token is stored.
 */
class Invitation extends Model
{
    use BelongsToAgency, HasFactory;

    protected $fillable = [
        'agency_id',
        'email',
        'role_ids',
        'token_hash',
        'expires_at',
        'invited_by',
        'accepted_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'role_ids' => 'array',
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isPending(): bool
    {
        return $this->accepted_at === null && $this->revoked_at === null;
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
