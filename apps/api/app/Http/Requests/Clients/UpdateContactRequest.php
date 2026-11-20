<?php

namespace App\Http\Requests\Clients;

class UpdateContactRequest extends ContactRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
