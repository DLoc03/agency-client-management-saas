<?php

namespace App\Http\Requests\Clients;

use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTagRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Tag names are unique within one agency (docs/CLIENT_CONTRACT.md).
            'name' => ['required', 'string', 'max:100',
                Rule::unique('tags', 'name')->where('agency_id', Tenant::id())],
            'color' => ['nullable', 'string', 'max:20'],
        ];
    }
}
