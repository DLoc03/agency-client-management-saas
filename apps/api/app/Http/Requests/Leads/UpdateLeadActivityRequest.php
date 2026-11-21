<?php

namespace App\Http\Requests\Leads;

class UpdateLeadActivityRequest extends LeadActivityRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
