<?php

namespace App\Http\Requests\Leads;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Optional payload of POST /leads/{id}/convert (docs/CRM_CONTRACT.md
 * section 5): an account manager override and the duplicate-guard
 * override flag. The manager reference gets the same cross-tenant
 * treatment as everywhere else (422 CROSS_TENANT_REFERENCE).
 */
class ConvertLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    public function rules(): array
    {
        return [
            'account_manager_id' => ['nullable', 'integer'],
            'force' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->filled('account_manager_id')) {
                $manager = User::find($this->input('account_manager_id'));
                if (! $manager) {
                    $validator->errors()->add('account_manager_id', 'User not found.');
                } elseif ($manager->agency_id !== $this->user()->agency_id) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'account_manager_id']);
                }
            }
        });
    }
}
