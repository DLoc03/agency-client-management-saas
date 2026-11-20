<?php

namespace App\Http\Requests\Clients;

class UpdateClientRequest extends ClientRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
