<?php

namespace App\Http\Requests\Projects;

use App\Exceptions\ApiException;
use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared payload rules for creating/updating a project, including the
 * cross-tenant reference checks of docs/PROJECT_CONTRACT.md section 6:
 * referencing another agency's client or user is a 422
 * CROSS_TENANT_REFERENCE, not a plain validation error.
 */
abstract class ProjectRequest extends FormRequest
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
            'name' => [...$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(Project::STATUSES)],
            'project_manager_id' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'budget' => ['nullable', 'numeric', 'min:0'],
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
                } elseif ($client->agency_id !== $this->user()->agency_id) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'client_id']);
                }
            }

            if ($this->filled('project_manager_id')) {
                $manager = User::find($this->input('project_manager_id'));
                if (! $manager) {
                    $validator->errors()->add('project_manager_id', 'User not found.');
                } elseif ($manager->agency_id !== $this->user()->agency_id) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'project_manager_id']);
                }
            }
        });
    }
}
