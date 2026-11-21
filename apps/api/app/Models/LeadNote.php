<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Internal note about a lead. Never exposed to the Portal. */
class LeadNote extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    protected $fillable = ['agency_id', 'lead_id', 'author_id', 'body'];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
