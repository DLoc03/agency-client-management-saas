<?php

namespace App\Http\Requests\Teams;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Shared team payload rules. A lead from another agency is a 422
 * CROSS_TENANT_REFERENCE (docs/TEAM_CONTRACT.md section 5).
 */
abstract class TeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    abstract protected function creating(): bool;

    public function rules(): array
    {
        $required = $this->creating() ? ['required'] : ['sometimes'];
        $agencyId = $this->user()->agency_id;

        $uniqueName = Rule::unique('teams', 'name')
            ->where('agency_id', $agencyId)
            ->whereNull('deleted_at');
        if (! $this->creating()) {
            $uniqueName->ignore($this->route('team'));
        }

        return [
            'name' => [...$required, 'string', 'max:255', $uniqueName],
            'description' => ['nullable', 'string', 'max:5000'],
            'lead_id' => ['nullable', 'integer'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('lead_id')) {
                return;
            }
            $lead = User::withoutGlobalScopes()->find($this->input('lead_id'));
            if (! $lead) {
                $validator->errors()->add('lead_id', 'User not found.');
            } elseif ($lead->agency_id !== $this->user()->agency_id) {
                throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'lead_id']);
            }
        });
    }
}
