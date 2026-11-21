<?php

namespace App\Http\Requests\Leads;

class UpdateLeadContactRequest extends LeadContactRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
