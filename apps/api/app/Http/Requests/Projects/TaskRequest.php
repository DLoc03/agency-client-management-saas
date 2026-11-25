<?php

namespace App\Http\Requests\Projects;

use App\Exceptions\ApiException;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared payload rules for creating/updating a task. Cross references
 * follow docs/PROJECT_CONTRACT.md section 6: an assignee from another
 * agency, or a milestone from another agency or another project, is a
 * 422 CROSS_TENANT_REFERENCE.
 */
abstract class TaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    abstract protected function creating(): bool;

    /** The project the task belongs (or will belong) to. */
    abstract protected function project(): ?Project;

    public function rules(): array
    {
        $required = $this->creating() ? ['required'] : ['sometimes'];

        return [
            'title' => [...$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(Task::STATUSES)],
            'priority' => ['sometimes', Rule::in(Task::PRIORITIES)],
            'milestone_id' => ['nullable', 'integer'],
            'assignee_id' => ['nullable', 'integer'],
            'due_date' => ['nullable', 'date'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->filled('assignee_id')) {
                $assignee = User::find($this->input('assignee_id'));
                if (! $assignee) {
                    $validator->errors()->add('assignee_id', 'User not found.');
                } elseif (! $assignee->hasActiveMembershipIn(Tenant::id())) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'assignee_id']);
                }
            }

            if ($this->filled('milestone_id')) {
                $milestone = Milestone::withoutGlobalScopes()->find($this->input('milestone_id'));
                if (! $milestone) {
                    $validator->errors()->add('milestone_id', 'Milestone not found.');
                } elseif ($milestone->agency_id !== Tenant::id()
                    || $milestone->project_id !== $this->project()?->id) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'milestone_id']);
                }
            }
        });
    }
}
