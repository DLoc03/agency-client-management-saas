<?php

namespace App\Http\Requests\Projects;

use App\Exceptions\ApiException;
use App\Models\Team;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreProjectTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['team_id' => ['required', 'integer']];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('team_id')) {
                return;
            }
            $team = Team::withoutGlobalScopes()->find($this->input('team_id'));
            if (! $team) {
                $validator->errors()->add('team_id', 'Team not found.');
            } elseif ($team->agency_id !== $this->user()->agency_id) {
                throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'team_id']);
            }
        });
    }
}
