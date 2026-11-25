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
            // DEC-018: an email that already has an identity is the
            // normal case (access is granted to that identity); the
            // controller rejects only an already-active access for
            // this client or a staff/client kind conflict.
            'email' => ['required', 'email', 'max:255'],
            // DEC-009.6: the agency sets the initial password in the MVP.
            'password' => ['required', 'string', 'min:8', 'max:255'],
            'locale' => ['sometimes', Rule::in(['en', 'vi'])],
        ];
    }
}
