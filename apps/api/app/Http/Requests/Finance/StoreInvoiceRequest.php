<?php

namespace App\Http\Requests\Finance;

class StoreInvoiceRequest extends InvoiceRequest
{
    protected function creating(): bool
    {
        return true;
    }
}
