<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Segmentation tag, unique per agency; shared later by leads/projects. */
class Tag extends Model
{
    use BelongsToAgency, HasFactory;

    protected $fillable = ['agency_id', 'name', 'color'];

    public function clients(): BelongsToMany
    {
        return $this->belongsToMany(Client::class);
    }
}
