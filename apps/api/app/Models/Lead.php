<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A sales lead (docs/CRM_CONTRACT.md). Entry point of the core flow
 * Lead → Client → Project → Task → Invoice. On conversion the lead is
 * kept for traceability and its main fields are locked.
 */
class Lead extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const STATUS_NEW = 'new';

    public const STATUS_CONTACTED = 'contacted';

    public const STATUS_QUALIFIED = 'qualified';

    public const STATUS_UNQUALIFIED = 'unqualified';

    public const STATUSES = [
        self::STATUS_NEW,
        self::STATUS_CONTACTED,
        self::STATUS_QUALIFIED,
        self::STATUS_UNQUALIFIED,
    ];

    public const SOURCES = ['website', 'referral', 'social', 'cold_outreach', 'other'];

    protected $fillable = [
        'agency_id', 'name', 'company_name', 'contact_name', 'email', 'phone',
        'source', 'status', 'estimated_value', 'owner_id', 'unqualified_reason',
        'converted_client_id', 'converted_at', 'last_contacted_at',
    ];

    protected function casts(): array
    {
        return [
            'estimated_value' => 'decimal:2',
            'converted_at' => 'datetime',
            'last_contacted_at' => 'datetime',
        ];
    }

    public function isConverted(): bool
    {
        return $this->converted_client_id !== null;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(LeadNote::class);
    }

    public function activities(): HasMany
    {
        return $this->hasMany(LeadActivity::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function convertedClient(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'converted_client_id');
    }
}
