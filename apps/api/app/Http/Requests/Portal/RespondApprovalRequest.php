<?php

namespace App\Http\Requests\Portal;

use App\Models\ApprovalRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A client responding to an approval request (docs/
 * PORTAL_CONTRACT.md section 3.1, DEC-028 Q6): the comment is
 * mandatory when requesting changes so the agency knows what to fix,
 * optional when approving.
 */
class RespondApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // the portal route group guards the surface
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(ApprovalRequest::DECISIONS)],
            'comment' => [
                Rule::requiredIf(fn () => $this->input('decision') === ApprovalRequest::STATUS_CHANGES_REQUESTED),
                'nullable', 'string', 'max:5000',
            ],
        ];
    }
}
