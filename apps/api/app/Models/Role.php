<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    public const OWNER = 'agency_owner';

    public const ADMIN = 'admin';

    public const SALES_MANAGER = 'sales_manager';

    public const PROJECT_MANAGER = 'project_manager';

    public const TEAM_MEMBER = 'team_member';

    public const ACCOUNTANT = 'accountant';

    /** All internal role keys (DEC-005). Client is NOT a role. */
    public const KEYS = [
        self::OWNER,
        self::ADMIN,
        self::SALES_MANAGER,
        self::PROJECT_MANAGER,
        self::TEAM_MEMBER,
        self::ACCOUNTANT,
    ];

    protected $fillable = ['key', 'name'];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
