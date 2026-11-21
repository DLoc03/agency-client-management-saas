<?php

namespace App\Http\Requests\Leads;

use App\Models\LeadActivity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

abstract class LeadActivityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    abstract protected function creating(): bool;

    public function rules(): array
    {
        $required = $this->creating() ? ['required'] : ['sometimes'];

        return [
            'type' => [...$required, Rule::in(LeadActivity::TYPES)],
            'scheduled_at' => [...$required, 'date'],
            'note' => ['nullable', 'string', 'max:5000'],
            'is_done' => ['sometimes', 'boolean'],
        ];
    }
}
