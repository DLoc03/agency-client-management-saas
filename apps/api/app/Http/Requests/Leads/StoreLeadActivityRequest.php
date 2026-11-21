<?php

namespace App\Http\Requests\Leads;

class StoreLeadActivityRequest extends LeadActivityRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
