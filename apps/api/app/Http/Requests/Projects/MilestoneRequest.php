<?php

namespace App\Http\Requests\Projects;

use App\Models\Milestone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

abstract class MilestoneRequest extends FormRequest
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
            'name' => [...$required, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'due_date' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::in(Milestone::STATUSES)],
            // Group 7 (DEC-028 Q1): per-milestone Portal visibility.
            'client_visible' => ['sometimes', 'boolean'],
        ];
    }
}
