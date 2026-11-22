<?php

namespace App\Http\Requests\Projects;

class StoreProjectRequest extends ProjectRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
