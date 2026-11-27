<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\UpdatePaymentDetailsRequest;
use App\Models\Agency;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;

/**
 * The agency's static bank-transfer / VietQR details shown on
 * invoices and PDFs (docs/FINANCE_CONTRACT.md sections 2 and 5.12).
 * Dedicated endpoint because Group 0 has no workspace-settings
 * screen yet. Only the caller's own agency can be addressed — any
 * other agency id resolves to 404, never to that agency's data.
 */
class AgencyPaymentDetailsController extends Controller
{
    /**
     * Read the saved details (FIX-031): the settings form prefills
     * from this instead of opening empty. Same permission and same
     * response shape as update(), so no shape change for the FE.
     */
    public function show(int $agencyId): JsonResponse
    {
        abort_unless($agencyId === Tenant::id(), 404);

        return response()->json(['data' => $this->payload(Agency::findOrFail($agencyId))]);
    }

    public function update(UpdatePaymentDetailsRequest $request, int $agencyId): JsonResponse
    {
        abort_unless($agencyId === Tenant::id(), 404);

        $agency = Agency::findOrFail($agencyId);
        $agency->update($request->validated());

        return response()->json(['data' => $this->payload($agency)]);
    }

    /** @return array<string, mixed> */
    private function payload(Agency $agency): array
    {
        return [
            'id' => $agency->id,
            'bank_name' => $agency->bank_name,
            'bank_account_number' => $agency->bank_account_number,
            'bank_account_holder' => $agency->bank_account_holder,
            'vietqr_payload' => $agency->vietqr_payload,
        ];
    }
}
