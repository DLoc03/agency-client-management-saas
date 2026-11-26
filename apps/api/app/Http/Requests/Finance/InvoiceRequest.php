<?php

namespace App\Http\Requests\Finance;

use App\Exceptions\ApiException;
use App\Models\Client;
use App\Models\Project;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Shared payload rules for creating/updating an invoice, including
 * the cross-tenant reference checks of docs/FINANCE_CONTRACT.md
 * section 7.1: referencing another agency's client or project is a
 * 422 CROSS_TENANT_REFERENCE, not a plain validation error (same
 * pattern as the Project module).
 */
abstract class InvoiceRequest extends FormRequest
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
            'client_id' => [...$required, 'integer'],
            'project_id' => ['nullable', 'integer'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['sometimes', 'array'],
            'items.*.description' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->filled('client_id')) {
                $client = Client::withoutGlobalScopes()->find($this->input('client_id'));
                if (! $client) {
                    $validator->errors()->add('client_id', 'Client not found.');
                } elseif ($client->agency_id !== Tenant::id()) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'client_id']);
                }
            }

            if ($this->filled('project_id')) {
                $project = Project::withoutGlobalScopes()->find($this->input('project_id'));
                if (! $project) {
                    $validator->errors()->add('project_id', 'Project not found.');
                } elseif ($project->agency_id !== Tenant::id()) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'project_id']);
                }
            }
        });
    }
}
