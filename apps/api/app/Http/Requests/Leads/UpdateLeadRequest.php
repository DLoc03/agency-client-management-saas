<?php

namespace App\Http\Requests\Leads;

class UpdateLeadRequest extends LeadRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
