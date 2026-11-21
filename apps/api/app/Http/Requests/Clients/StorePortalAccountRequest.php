<?php

namespace App\Http\Requests\Clients;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePortalAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // DEC-008: email is globally unique across both account types.
            'email' => ['required', 'email', 'max:255',
                Rule::unique('client_accounts', 'email'),
                Rule::unique('users', 'email')],
            // DEC-009.6: the agency sets the initial password in the MVP.
            'password' => ['required', 'string', 'min:8', 'max:255'],
            'locale' => ['sometimes', Rule::in(['en', 'vi'])],
        ];
    }
}
