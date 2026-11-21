<?php

namespace App\Http\Requests\Leads;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Payload rules for contacts nested under a lead. Same fields as the
 * client-side contacts, minus organization_id: a lead has no
 * organization record (that is only created at conversion time).
 */
abstract class LeadContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    abstract protected function creating(): bool;

    public function rules(): array
    {
        $required = $this->creating() ? ['required'] : ['sometimes'];

        return [
            'full_name' => [...$required, 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'position' => ['nullable', 'string', 'max:255'],
            'is_primary' => ['sometimes', 'boolean'],
        ];
    }
}
