<?php

namespace App\Http\Requests\Projects;

class UpdateChecklistItemRequest extends ChecklistItemRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
