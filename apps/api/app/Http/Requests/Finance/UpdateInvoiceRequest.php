<?php

namespace App\Http\Requests\Finance;

class UpdateInvoiceRequest extends InvoiceRequest
{
    protected function creating(): bool
    {
        return false;
    }
}
