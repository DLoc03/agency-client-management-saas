<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Company details of a client (DEC-009.1: separate table, 1-1 with Client). */
class Organization extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    protected $fillable = [
        'agency_id', 'client_id', 'legal_name', 'industry', 'size',
        'address', 'tax_code', 'website',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
