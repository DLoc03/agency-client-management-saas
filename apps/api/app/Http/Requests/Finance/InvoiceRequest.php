<?php

namespace App\Http\Requests\Finance;

use App\Exceptions\ApiException;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Project;
use App\Support\Tenant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Shared payload rules for creating/updating an invoice, including
 * the cross-tenant reference checks of docs/FINANCE_CONTRACT.md
 * section 7.1: referencing another agency's client or project is a
 * 422 CROSS_TENANT_REFERENCE, not a plain validation error (same
 * pattern as the Project module).
 */
abstract class InvoiceRequest extends FormRequest
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
            'client_id' => [...$required, 'integer'],
            'project_id' => ['nullable', 'integer'],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['sometimes', 'array'],
            'items.*.description' => ['required_with:items', 'string', 'max:255'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required_with:items', 'numeric', 'min:0'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            // The client this invoice will belong to: the supplied
            // client_id on create, or on update the supplied one,
            // falling back to the bound invoice's stored client when
            // the request only changes the project.
            $clientId = null;
            $clientKnown = false;

            if ($this->filled('client_id')) {
                $client = Client::withoutGlobalScopes()->find($this->input('client_id'));
                if (! $client) {
                    $validator->errors()->add('client_id', 'Client not found.');
                } elseif ($client->agency_id !== Tenant::id()) {
                    throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'client_id']);
                } else {
                    $clientId = $client->id;
                    $clientKnown = true;
                }
            } elseif (! $this->creating()) {
                $invoice = $this->route('invoice');
                if ($invoice instanceof Invoice) {
                    $clientId = $invoice->client_id;
                    $clientKnown = true;
                }
            }

            // The (client, project) pair is only re-checked when the
            // request touches either side of it — a PATCH that changes
            // neither cannot make a previously valid pair invalid.
            // The effective project is the supplied one, or on update
            // the invoice's stored project when only the client moves.
            if (! $this->creating() && ! $this->filled('client_id') && ! $this->filled('project_id')) {
                return;
            }

            $projectId = $this->filled('project_id')
                ? (int) $this->input('project_id')
                : (! $this->creating() && $this->route('invoice') instanceof Invoice
                    ? $this->route('invoice')->project_id
                    : null);

            if ($projectId === null) {
                return;
            }

            $project = Project::withoutGlobalScopes()->find($projectId);
            if (! $project) {
                if ($this->filled('project_id')) {
                    $validator->errors()->add('project_id', 'Project not found.');
                }
            } elseif ($this->filled('project_id') && $project->agency_id !== Tenant::id()) {
                throw new ApiException('CROSS_TENANT_REFERENCE', 422, ['field' => 'project_id']);
            } elseif ($clientKnown && $project->client_id !== $clientId) {
                // FIX-031 (docs/FINANCE_CONTRACT.md section 4.3):
                // a project belongs to exactly one client, so an
                // invoice may only reference a project of its own
                // client — same-agency, different-client is a
                // mismatch, not a cross-tenant reference.
                throw new ApiException('PROJECT_CLIENT_MISMATCH', 422, ['field' => 'project_id']);
            }
        });
    }
}
