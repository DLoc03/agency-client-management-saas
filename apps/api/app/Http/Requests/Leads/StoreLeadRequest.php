<?php

namespace App\Http\Requests\Leads;

class StoreLeadRequest extends LeadRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
