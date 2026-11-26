<?php

namespace App\Http\Requests\Invitations;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class AcceptInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // BE-010 (DEC-020): name + password are only needed when the
        // accept creates a brand-new identity. An invitee who already
        // has an identity accepts by confirming while signed in, so
        // both fields are optional here and the controller enforces
        // them on the new-identity path only.
        return [
            'token' => ['required', 'string'],
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'password' => ['sometimes', 'nullable', Password::min(8)],
        ];
    }
}
