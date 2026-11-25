<?php

namespace App\Http\Requests\Teams;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreTeamMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['user_id' => ['required', 'integer']];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty() || ! $this->filled('user_id')) {
                return;
            }
            $member = User::withoutGlobalScopes()->find($this->input('user_id'));
            if (! $member) {
                $validator->errors()->add('user_id', 'User not found.');
            } elseif (! $member->hasActiveMembershipIn(Tenant::id())) {
                throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'user_id']);
            }
        });
    }
}
