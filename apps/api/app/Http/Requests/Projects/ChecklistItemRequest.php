<?php

namespace App\Http\Requests\Projects;

use Illuminate\Foundation\Http\FormRequest;

abstract class ChecklistItemRequest extends FormRequest
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
            'title' => [...$required, 'string', 'max:255'],
            'is_done' => ['sometimes', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
