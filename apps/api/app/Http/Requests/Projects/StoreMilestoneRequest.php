<?php

namespace App\Http\Requests\Projects;

class StoreMilestoneRequest extends MilestoneRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
