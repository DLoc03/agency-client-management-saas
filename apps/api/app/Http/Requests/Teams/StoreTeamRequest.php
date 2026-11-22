<?php

namespace App\Http\Requests\Teams;

class StoreTeamRequest extends TeamRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
