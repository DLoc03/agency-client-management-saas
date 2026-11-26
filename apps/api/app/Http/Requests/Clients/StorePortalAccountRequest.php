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
            // BE-010 (DEC-020): name and password are accepted for
            // backward compatibility but ignored — a brand-new email
            // now receives an invitation link and sets its own name
            // and password when accepting.
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            // DEC-018: an email that already has an identity is the
            // normal case (access is granted to that identity); the
            // controller rejects only an already-active access for
            // this client or a staff/client kind conflict.
            'email' => ['required', 'email', 'max:255'],
            // DEC-009.6 (agency-set password) is superseded by DEC-020.
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'max:255'],
            'locale' => ['sometimes', Rule::in(['en', 'vi'])],
        ];
    }
}
