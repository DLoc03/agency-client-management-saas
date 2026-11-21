<?php

namespace App\Http\Requests\Clients;

class StoreClientRequest extends ClientRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
