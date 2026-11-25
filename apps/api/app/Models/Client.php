<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A client of the agency (docs/CLIENT_CONTRACT.md). Internal record only —
 * the people logging into the Portal hold client Memberships linked here.
 */
class Client extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const TYPE_COMPANY = 'company';

    public const TYPE_INDIVIDUAL = 'individual';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_PAUSED = 'paused';

    public const STATUS_CHURNED = 'churned';

    protected $fillable = [
        'agency_id', 'name', 'type', 'status', 'account_manager_id', 'source_lead_id',
        'email', 'phone', 'website', 'address', 'tax_code',
    ];

    public function organization(): HasOne
    {
        return $this->hasOne(Organization::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(ClientNote::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function portalAccounts(): HasMany
    {
        // DEC-018: Portal access = client memberships on the single
        // identity (the ClientAccount table no longer exists).
        return $this->hasMany(Membership::class)->where('kind', Membership::KIND_CLIENT);
    }

    public function accountManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_manager_id');
    }

    /** The lead this client was converted from, if any (DEC-014). */
    public function sourceLead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'source_lead_id');
    }
}
