<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\StoreInvoiceRequest;
use App\Http\Requests\Finance\UpdateInvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Agency;
use App\Models\Invoice;
use App\Support\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Finance & Billing (docs/FINANCE_CONTRACT.md, DEC-019). Permissions
 * are enforced by route middleware; tenancy by the BelongsToAgency
 * scope (cross-agency ids resolve to 404, cross-agency references in
 * the payload to 422 — see the Finance form requests).
 */
class InvoiceController extends Controller
{
    /** Current date in the workspace timezone (Overdue derivation). */
    private function workspaceToday(): string
    {
        $timezone = Agency::find(Tenant::id())?->timezone ?: config('app.timezone');

        return Carbon::now($timezone)->toDateString();
    }

    /** Reload an invoice the way show() returns it. */
    private function present(Invoice $invoice): Invoice
    {
        return $invoice->newQuery()
            ->withSum('payments', 'amount')
            ->with(['client', 'project', 'items', 'payments.recorder', 'agency'])
            ->findOrFail($invoice->id);
    }

    /** Replace all line items; amounts are stored (qty x price, rounded). */
    private function syncItems(Invoice $invoice, array $items): void
    {
        $invoice->items()->delete();

        foreach (array_values($items) as $index => $item) {
            $invoice->items()->create([
                'description' => $item['description'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'amount' => round((float) $item['quantity'] * (float) $item['unit_price'], 2),
                'sort_order' => $index,
            ]);
        }
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $invoices = Invoice::query()
            ->with(['client', 'project', 'agency'])
            ->withSum('payments', 'amount')
            ->when($request->filled('client_id'), fn ($q) => $q->where('client_id', $request->integer('client_id')))
            ->when($request->filled('project_id'), fn ($q) => $q->where('project_id', $request->integer('project_id')))
            ->when($request->filled('status'), function ($q) use ($request) {
                $status = $request->string('status')->toString();
                if ($status === Invoice::STATUS_OVERDUE) {
                    // Derived status (contract 4.3): stored "sent",
                    // past the due date, with a balance still due.
                    $q->where('status', Invoice::STATUS_SENT)
                        ->whereNotNull('due_date')
                        ->whereDate('due_date', '<', $this->workspaceToday())
                        ->whereRaw('invoices.total > (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payments.invoice_id = invoices.id AND payments.deleted_at IS NULL)');
                } else {
                    $q->where('status', $status);
                }
            })
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%'.$request->string('q').'%';
                $q->where(fn ($w) => $w->where('number', 'like', $term)
                    ->orWhereHas('client', fn ($c) => $c->where('name', 'like', $term)));
            })
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return InvoiceResource::collection($invoices);
    }

    public function store(StoreInvoiceRequest $request): JsonResponse
    {
        $data = $request->validated();

        $invoice = DB::transaction(function () use ($data) {
            $issueDate = isset($data['issue_date']) ? Carbon::parse($data['issue_date']) : Carbon::today();

            $invoice = Invoice::create([
                'client_id' => $data['client_id'],
                'project_id' => $data['project_id'] ?? null,
                // Assigned at creation and immutable (contract 4.1).
                'number' => Invoice::nextNumber(Tenant::id(), (int) $issueDate->format('Y')),
                'issue_date' => $issueDate->toDateString(),
                'due_date' => $data['due_date'] ?? null,
                'tax_rate' => $data['tax_rate'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncItems($invoice, $data['items'] ?? []);
            $invoice->recomputeTotals();
            $invoice->save();

            return $invoice;
        });

        return InvoiceResource::make($this->present($invoice))->response()->setStatusCode(201);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        return InvoiceResource::make($this->present($invoice));
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice): InvoiceResource
    {
        // Line items and figures are locked from Sent on (contract 4.2).
        if ($invoice->status !== Invoice::STATUS_DRAFT) {
            throw new ApiException('INVOICE_NOT_EDITABLE', 422);
        }

        $data = $request->validated();

        DB::transaction(function () use ($invoice, $data, $request) {
            $invoice->fill(collect($data)->except('items')->all());

            if ($request->has('items')) {
                $this->syncItems($invoice, $data['items'] ?? []);
            }
            if ($request->has('items') || $request->has('tax_rate')) {
                $invoice->recomputeTotals();
            }

            $invoice->save();
        });

        return InvoiceResource::make($this->present($invoice));
    }

    public function destroy(Invoice $invoice): Response
    {
        // Only a Draft can be deleted (contract 4.3); the route's
        // invoices.delete permission is Owner-only.
        if ($invoice->status !== Invoice::STATUS_DRAFT) {
            throw new ApiException('CANNOT_DELETE_INVOICE', 422);
        }

        $invoice->delete();

        return response()->noContent();
    }

    public function send(Invoice $invoice): InvoiceResource
    {
        if ($invoice->status !== Invoice::STATUS_DRAFT) {
            throw new ApiException('INVOICE_NOT_EDITABLE', 422);
        }
        if ($invoice->items()->count() === 0) {
            throw new ApiException('INVOICE_EMPTY', 422);
        }

        $invoice->forceFill(['status' => Invoice::STATUS_SENT, 'sent_at' => now()])->save();

        return InvoiceResource::make($this->present($invoice));
    }

    public function cancel(Invoice $invoice): InvoiceResource
    {
        // Only a Sent invoice with no payments can be cancelled; Paid
        // can never be cancelled (no refunds in the MVP, contract 4.3).
        if ($invoice->status !== Invoice::STATUS_SENT || $invoice->payments()->exists()) {
            throw new ApiException('CANNOT_CANCEL_INVOICE', 422);
        }

        $invoice->forceFill(['status' => Invoice::STATUS_CANCELLED])->save();

        return InvoiceResource::make($this->present($invoice));
    }

    public function pdf(Invoice $invoice): Response
    {
        $invoice->load(['client', 'project', 'items', 'agency']);

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'paidTotal' => $invoice->paidTotal(),
            'balanceDue' => $invoice->balanceDue(),
        ]);

        return $pdf->download($invoice->number.'.pdf');
    }
}
