<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A scheduled follow-up on a lead (docs/CRM_CONTRACT.md section 2).
 * Push reminders belong to Group 0; the MVP exposes a due-list endpoint.
 */
class LeadActivity extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const TYPES = ['call', 'message', 'meeting', 'other'];

    protected $fillable = [
        'agency_id', 'lead_id', 'type', 'scheduled_at', 'note',
        'is_done', 'completed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'completed_at' => 'datetime',
            'is_done' => 'boolean',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
