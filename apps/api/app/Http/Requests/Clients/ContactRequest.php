<?php

namespace App\Http\Requests\Clients;

use App\Exceptions\ApiException;
use App\Models\Organization;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

abstract class ContactRequest extends FormRequest
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
            'organization_id' => ['nullable', 'integer'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('organization_id')) {
                return;
            }
            $organization = Organization::withoutGlobalScopes()->find($this->input('organization_id'));
            if (! $organization) {
                $validator->errors()->add('organization_id', 'Organization not found.');

                return;
            }
            if ($organization->agency_id !== Tenant::id()) {
                throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'organization_id']);
            }
            // Same agency but another client's organization: plain bad reference.
            if ($organization->client_id !== $this->route('client')->id) {
                $validator->errors()->add('organization_id', 'Organization does not belong to this client.');
            }
        });
    }
}
