<?php

namespace App\Http\Requests\Teams;

class UpdateTeamRequest extends TeamRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
