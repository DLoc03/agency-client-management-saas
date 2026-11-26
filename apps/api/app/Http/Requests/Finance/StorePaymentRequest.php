<?php

namespace App\Http\Requests\Finance;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Recording a manual payment (docs/FINANCE_CONTRACT.md section 4.4).
 * The status and balance checks live in the controller because they
 * depend on the invoice's live figures, not just the payload shape.
 */
class StorePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'gt:0'],
            'paid_on' => ['nullable', 'date'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
