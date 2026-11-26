<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A pending workspace invitation (docs/TEAM_CONTRACT.md section 2).
 * Only the SHA-256 hash of the accept token is stored.
 */
class Invitation extends Model
{
    use BelongsToAgency, HasFactory;

    public const KIND_STAFF = 'staff';

    public const KIND_CLIENT = 'client';

    protected $fillable = [
        'agency_id',
        'user_id',
        'kind',
        'client_id',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * Issue a fresh accept token (only its SHA-256 hash is stored)
     * with a new 7-day expiry; any previous token dies. Returns the
     * raw token for the emailed link.
     */
    public function issueToken(): string
    {
        $rawToken = Str::random(64);
        $this->token_hash = hash('sha256', $rawToken);
        $this->expires_at = now()->addDays(7);

        return $rawToken;
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
