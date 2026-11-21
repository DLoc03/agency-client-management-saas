<?php

namespace App\Http\Requests\Leads;

class StoreLeadContactRequest extends LeadContactRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
