<?php

namespace App\Http\Requests\Projects;

class StoreChecklistItemRequest extends ChecklistItemRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
