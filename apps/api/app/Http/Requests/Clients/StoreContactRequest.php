<?php

namespace App\Http\Requests\Clients;

class StoreContactRequest extends ContactRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
