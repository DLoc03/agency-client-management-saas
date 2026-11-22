<?php

namespace App\Http\Requests\Projects;

class UpdateProjectRequest extends ProjectRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
