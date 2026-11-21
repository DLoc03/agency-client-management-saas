<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A contact person, shared between clients and leads (DEC-014): each
 * contact belongs to exactly one owner — a client XOR a lead.
 */
class Contact extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    protected $fillable = [
        'agency_id', 'client_id', 'lead_id', 'organization_id', 'full_name',
        'email', 'phone', 'position', 'is_primary',
    ];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
