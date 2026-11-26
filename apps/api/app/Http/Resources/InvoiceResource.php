<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Internal invoice view (docs/FINANCE_CONTRACT.md). `status` is the
 * derived status (a sent invoice past due reads "overdue");
 * `stored_status` keeps the raw column value for the FE. Totals are
 * the stored figures; paid_total / balance_due are read-time.
 */
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'status' => $this->derivedStatus(),
            'stored_status' => $this->status,
            'client' => $this->whenLoaded('client', fn () => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->name,
            ] : null),
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
            'sent_at' => $this->sent_at?->toISOString(),
            'paid_at' => $this->paid_at?->toISOString(),
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'payment_details' => $this->whenLoaded('agency', fn () => [
                'bank_name' => $this->agency->bank_name,
                'bank_account_number' => $this->agency->bank_account_number,
                'bank_account_holder' => $this->agency->bank_account_holder,
                'vietqr_payload' => $this->agency->vietqr_payload,
            ]),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
