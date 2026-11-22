<?php

namespace App\Http\Requests\Projects;

use App\Models\Project;

class UpdateTaskRequest extends TaskRequest
{
    protected function creating(): bool
    {
        return false;
    }

    protected function project(): ?Project
    {
        return $this->route('task')?->project;
    }
}
