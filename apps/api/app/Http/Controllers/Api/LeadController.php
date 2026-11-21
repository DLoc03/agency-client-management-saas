<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Leads\ConvertLeadRequest;
use App\Http\Requests\Leads\StoreLeadRequest;
use App\Http\Requests\Leads\UpdateLeadRequest;
use App\Http\Resources\ClientResource;
use App\Http\Resources\LeadResource;
use App\Models\Client;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * CRM lead management (docs/CRM_CONTRACT.md). Permissions are enforced
 * by route middleware; tenancy by the BelongsToAgency scope
 * (cross-agency ids resolve to 404).
 */
class LeadController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $leads = Lead::query()
            ->with('owner')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('owner_id'), fn ($q) => $q->where('owner_id', $request->integer('owner_id')))
            ->when($request->filled('source'), fn ($q) => $q->where('source', $request->string('source')))
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%'.$request->string('q').'%';
                $q->where(fn ($w) => $w->where('name', 'like', $term)
                    ->orWhere('company_name', 'like', $term)
                    ->orWhere('email', 'like', $term));
            })
            ->latest()
            ->paginate(min($request->integer('per_page', 15), 100));

        return LeadResource::collection($leads);
    }

    public function store(StoreLeadRequest $request): JsonResponse
    {
        $lead = Lead::create($request->validated());

        // FIX-005 pattern: reload so column defaults (status, source)
        // are reflected in the response.
        return LeadResource::make($lead->refresh()->load('owner'))
            ->response()->setStatusCode(201);
    }

    public function show(Lead $lead): LeadResource
    {
        return LeadResource::make(
            $lead->load(['owner', 'contacts'])->loadCount(['notes', 'activities'])
        );
    }

    public function update(UpdateLeadRequest $request, Lead $lead): LeadResource
    {
        // DEC-014: a converted lead is locked; its history (notes and
        // activities) stays writable through the nested endpoints.
        if ($lead->isConverted()) {
            throw new ApiException('LEAD_ALREADY_CONVERTED', 409);
        }

        $lead->update($request->validated());

        return LeadResource::make($lead->load('owner'));
    }

    public function destroy(Lead $lead): Response
    {
        $lead->delete();

        return response()->noContent();
    }

    /** Lead count and total estimated value per pipeline status. */
    public function pipelineSummary(): JsonResponse
    {
        $rows = Lead::query()
            ->selectRaw('status, COUNT(*) as leads_count, COALESCE(SUM(estimated_value), 0) as total_estimated_value')
            ->groupBy('status')
            ->get()
            ->keyBy('status');

        $data = collect(Lead::STATUSES)->map(fn (string $status) => [
            'status' => $status,
            'leads_count' => (int) ($rows[$status]->leads_count ?? 0),
            'total_estimated_value' => (float) ($rows[$status]->total_estimated_value ?? 0),
        ]);

        return response()->json(['data' => $data]);
    }

    /**
     * Lead → Client conversion (docs/CRM_CONTRACT.md section 4): creates
     * the Client (+ Organization for companies + a primary Contact),
     * re-links the lead's contacts to the client and locks the lead.
     * Returns the created client.
     */
    public function convert(ConvertLeadRequest $request, Lead $lead): JsonResponse
    {
        if ($lead->isConverted()) {
            throw new ApiException('LEAD_ALREADY_CONVERTED', 409);
        }

        // Duplicate guard: an existing client with the same email blocks
        // conversion unless explicitly forced. (A lead carries no
        // tax_code, so the contract's tax_code arm cannot match here.)
        if (! $request->boolean('force') && filled($lead->email)
            && Client::query()->where('email', $lead->email)->exists()) {
            throw new ApiException('DUPLICATE_CLIENT_CANDIDATE', 422, ['field' => 'email']);
        }

        $client = DB::transaction(function () use ($request, $lead) {
            $isCompany = filled($lead->company_name);

            $client = Client::create([
                'name' => $isCompany ? $lead->company_name : $lead->name,
                'type' => $isCompany ? Client::TYPE_COMPANY : Client::TYPE_INDIVIDUAL,
                'status' => Client::STATUS_ACTIVE,
                'account_manager_id' => $request->validated('account_manager_id') ?? $lead->owner_id,
                'source_lead_id' => $lead->id,
                'email' => $lead->email,
                'phone' => $lead->phone,
            ]);

            if ($isCompany) {
                $client->organization()->create(['legal_name' => $lead->company_name]);
            }

            // The lead's existing contacts move to the client.
            $lead->contacts()->update(['client_id' => $client->id, 'lead_id' => null]);

            // Plus a primary contact built from the lead's own fields.
            if (filled($lead->contact_name) || filled($lead->email) || filled($lead->phone)) {
                $client->contacts()->create([
                    'full_name' => $lead->contact_name ?? $lead->name,
                    'email' => $lead->email,
                    'phone' => $lead->phone,
                    'is_primary' => true,
                ]);
            }

            $lead->update([
                'converted_client_id' => $client->id,
                'converted_at' => now(),
            ]);

            return $client;
        });

        return ClientResource::make(
            $client->refresh()->load(['organization', 'contacts', 'tags', 'accountManager'])->loadCount('portalAccounts')
        )->response()->setStatusCode(201);
    }
}
