<?php

namespace App\Http\Requests\Projects;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreProjectMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
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

            $member = User::find($this->input('user_id'));
            if (! $member) {
                $validator->errors()->add('user_id', 'User not found.');
            } elseif ($member->agency_id !== $this->user()->agency_id) {
                throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'user_id']);
            }
        });
    }
}
