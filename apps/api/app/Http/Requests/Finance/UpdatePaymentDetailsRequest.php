<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The agency's static bank-transfer / VietQR details shown on
 * invoices (docs/FINANCE_CONTRACT.md sections 2 and 5.12). PATCH
 * semantics: every field is optional, null clears it.
 */
class UpdatePaymentDetailsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    public function rules(): array
    {
        return [
            'bank_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bank_account_number' => ['sometimes', 'nullable', 'string', 'max:64'],
            'bank_account_holder' => ['sometimes', 'nullable', 'string', 'max:255'],
            'vietqr_payload' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }
}
