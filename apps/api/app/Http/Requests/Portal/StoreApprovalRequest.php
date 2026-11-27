<?php

namespace App\Http\Requests\Portal;

use App\Exceptions\ApiException;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Creating an approval request (docs/PORTAL_CONTRACT.md section 3.2).
 * The request approves a file, a milestone, or — with a free-text
 * title — a written hand-over. Cross references follow the usual
 * contract pattern: a reference from another agency is a 422
 * CROSS_TENANT_REFERENCE; one that does not exist or belongs to a
 * different project is a plain validation error.
 */
class StoreApprovalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // permission middleware guards the route
    }

    /** The project the approval will belong to (route-bound). */
    protected function project(): ?Project
    {
        return $this->route('project');
    }

    public function rules(): array
    {
        return [
            'file_id' => ['nullable', 'integer'],
            'milestone_id' => ['nullable', 'integer'],
            // Required for a free-text hand-over; when the request
            // points at a file/milestone the controller defaults the
            // title from that target if omitted.
            'title' => ['required_without_all:file_id,milestone_id', 'nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if ($this->filled('file_id')) {
                // Bypass reason: unscoped lookup is safe — agency_id
                // and project_id are verified explicitly right below,
                // and a foreign row answers 422 CROSS_TENANT_REFERENCE
                // instead of looking like a missing file.
                $file = ProjectFile::withoutGlobalScopes()->find($this->input('file_id'));
                if (! $file) {
                    $validator->errors()->add('file_id', 'File not found.');
                } elseif ($file->agency_id !== Tenant::id()
                    || $file->project_id !== $this->project()?->id) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'file_id']);
                }
            }

            if ($this->filled('milestone_id')) {
                // Bypass reason: unscoped lookup is safe — agency_id
                // and project_id are verified explicitly right below,
                // and a foreign row answers 422 CROSS_TENANT_REFERENCE
                // instead of looking like a missing milestone.
                $milestone = Milestone::withoutGlobalScopes()->find($this->input('milestone_id'));
                if (! $milestone) {
                    $validator->errors()->add('milestone_id', 'Milestone not found.');
                } elseif ($milestone->agency_id !== Tenant::id()
                    || $milestone->project_id !== $this->project()?->id) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'milestone_id']);
                }
            }
        });
    }
}
