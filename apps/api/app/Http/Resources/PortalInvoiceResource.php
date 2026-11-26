<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Read-only Portal invoice view (docs/FINANCE_CONTRACT.md section
 * 4.6): amounts, derived status, balance due, line items and the
 * agency's bank details so the client can transfer. No payment
 * records, no internal fields, no budget figures.
 */
class PortalInvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->derivedStatus(),
            'project' => $this->whenLoaded('project', fn () => $this->project ? [
                'id' => $this->project->id,
                'name' => $this->project->name,
            ] : null),
            'issue_date' => $this->issue_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'tax_rate' => $this->tax_rate,
            'subtotal' => $this->subtotal,
            'tax_amount' => $this->tax_amount,
            'total' => $this->total,
            'paid_total' => number_format($this->paidTotal(), 2, '.', ''),
            'balance_due' => number_format($this->balanceDue(), 2, '.', ''),
            'notes' => $this->notes,
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'payment_details' => $this->whenLoaded('agency', fn () => [
                'bank_name' => $this->agency->bank_name,
                'bank_account_number' => $this->agency->bank_account_number,
                'bank_account_holder' => $this->agency->bank_account_holder,
                'vietqr_payload' => $this->agency->vietqr_payload,
            ]),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
