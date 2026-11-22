<?php

namespace App\Http\Requests\Projects;

use App\Models\Project;

class StoreTaskRequest extends TaskRequest
{
    protected function creating(): bool
    {
        return true;
    }

    protected function project(): ?Project
    {
        return $this->route('project');
    }
}
