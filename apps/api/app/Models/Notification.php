<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One in-app notification for one identity in one agency
 * (docs/WORKFLOW_CONTRACT.md, DEC-026). Custom model on a custom
 * table — NOT Laravel's database-notification store — so tenancy,
 * retention and dedupe follow the project's own rules. `type` and
 * `data` carry keys/params only, never display text.
 */
class Notification extends Model
{
    use BelongsToAgency, HasFactory;

    protected $fillable = [
        'agency_id', 'user_id', 'type', 'data', 'dedupe_key', 'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUnread(Builder $query): Builder
    {
        return $query->whereNull('read_at');
    }

    public function isRead(): bool
    {
        return $this->read_at !== null;
    }
}
