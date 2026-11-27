<?php

namespace App\Http\Requests\Portal;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A message in a project's Portal discussion thread
 * (docs/PORTAL_CONTRACT.md section 3). Shared by the Portal side
 * (client writes) and the internal side (staff replies) — permission
 * middleware guards each route.
 */
class StorePortalCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:5000'],
        ];
    }
}
