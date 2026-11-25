<?php

namespace App\Http\Requests\Leads;

use App\Exceptions\ApiException;
use App\Models\Lead;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared payload rules for creating/updating a lead, including the
 * cross-tenant reference check of docs/CRM_CONTRACT.md section 6:
 * referencing another agency's user as owner is a 422
 * CROSS_TENANT_REFERENCE, not a plain validation error.
 */
abstract class LeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    abstract protected function creating(): bool;

    public function rules(): array
    {
        $required = $this->creating() ? ['required'] : ['sometimes'];

        return [
            'name' => [...$required, 'string', 'max:255'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'source' => ['sometimes', Rule::in(Lead::SOURCES)],
            'status' => ['sometimes', Rule::in(Lead::STATUSES)],
            'estimated_value' => ['nullable', 'numeric', 'min:0'],
            'owner_id' => ['nullable', 'integer'],
            'unqualified_reason' => ['nullable', 'string', 'max:2000'],
            'last_contacted_at' => ['nullable', 'date'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->filled('owner_id')) {
                $owner = User::find($this->input('owner_id'));
                if (! $owner) {
                    $validator->errors()->add('owner_id', 'User not found.');
                } elseif (! $owner->hasActiveMembershipIn(Tenant::id())) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'owner_id']);
                }
            }
        });
    }
}
