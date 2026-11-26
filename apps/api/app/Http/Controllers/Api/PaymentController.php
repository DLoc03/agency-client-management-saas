<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Manual payment recording (docs/FINANCE_CONTRACT.md section 4.4).
 * Payments exist only on Sent invoices (a stored "sent" includes the
 * derived Overdue ones); recording and deleting recompute the
 * invoice's balance and stored status.
 */
class PaymentController extends Controller
{
    public function index(Request $request, Invoice $invoice): AnonymousResourceCollection
    {
        $payments = $invoice->payments()
            ->with('recorder')
            ->paginate(min($request->integer('per_page', 15), 100));

        return PaymentResource::collection($payments);
    }

    public function store(StorePaymentRequest $request, Invoice $invoice): JsonResponse
    {
        if ($invoice->status !== Invoice::STATUS_SENT) {
            throw new ApiException('PAYMENT_NOT_ALLOWED', 422);
        }

        $amount = round((float) $request->validated('amount'), 2);
        if ($amount > $invoice->balanceDue()) {
            throw new ApiException('OVERPAYMENT_NOT_ALLOWED', 422);
        }

        $payment = DB::transaction(function () use ($request, $invoice, $amount) {
            $payment = $invoice->payments()->create([
                'amount' => $amount,
                'paid_on' => $request->validated('paid_on') ?? now()->toDateString(),
                'method' => $request->validated('method'),
                'note' => $request->validated('note'),
                'recorded_by' => $request->user()->id,
            ]);

            $invoice->refreshStatusFromPayments();

            return $payment;
        });

        return PaymentResource::make($payment->refresh()->load('recorder'))
            ->response()->setStatusCode(201);
    }

    public function destroy(Payment $payment): Response
    {
        // Deleting a payment is an error correction (contract 4.4):
        // the invoice balance/status is recomputed right after.
        DB::transaction(function () use ($payment) {
            $invoice = $payment->invoice;
            $payment->delete();
            $invoice?->refreshStatusFromPayments();
        });

        return response()->noContent();
    }
}
