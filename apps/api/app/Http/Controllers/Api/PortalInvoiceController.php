<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PortalInvoiceResource;
use App\Models\Invoice;
use App\Support\Tenant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only Portal view of the signed-in client's own invoices
 * (docs/FINANCE_CONTRACT.md section 4.6). Same scoping pattern as
 * the Portal project view: the tenant context comes from the client
 * membership bound to the token, and the query is pinned to that
 * membership's client record. Recording payments stays internal.
 */
class PortalInvoiceController extends Controller
{
    private function scopedQuery()
    {
        return Invoice::query()
            ->where('client_id', Tenant::membership()->client_id)
            ->withSum('payments', 'amount');
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $invoices = $this->scopedQuery()
            ->with(['project', 'agency'])
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return PortalInvoiceResource::collection($invoices);
    }

    public function show(int $invoiceId): PortalInvoiceResource
    {
        $invoice = $this->scopedQuery()
            ->with(['project', 'items', 'agency'])
            ->findOrFail($invoiceId);

        return PortalInvoiceResource::make($invoice);
    }
}
