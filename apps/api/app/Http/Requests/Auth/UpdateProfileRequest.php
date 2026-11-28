<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Supported locales follow the SetApiLocale source of
            // truth (DEC-006): `en` + `vi`, same as every other
            // locale field in the codebase.
            'locale' => ['required', 'string', Rule::in(['en', 'vi'])],
        ];
    }
}
