<?php

namespace App\Http\Requests\Projects;

class UpdateMilestoneRequest extends MilestoneRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
