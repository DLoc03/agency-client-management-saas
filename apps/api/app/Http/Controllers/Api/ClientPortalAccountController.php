<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Clients\StorePortalAccountRequest;
use App\Http\Requests\Clients\UpdatePortalAccountRequest;
use App\Http\Resources\InvitationResource;
use App\Http\Resources\PortalAccountResource;
use App\Mail\InvitationMail;
use App\Models\Client;
use App\Models\Invitation;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Agency-side management of a client's Portal access
 * (docs/CLIENT_CONTRACT.md section 4, reworked by DEC-018 + DEC-020).
 *
 * Portal access is a client Membership on the person's single
 * identity: if the email already has an identity, access is granted
 * to that identity immediately (no second password). Since BE-010
 * (DEC-020) a brand-new email no longer gets an agency-set password:
 * the person receives a client invitation link and sets their own
 * password when accepting, which creates the identity and the
 * membership. Authentication itself lives in PortalAuthController.
 */
class ClientPortalAccountController extends Controller
{
    public function index(Client $client): AnonymousResourceCollection
    {
        $memberships = $client->portalAccounts()->with('user')->latest()->get();

        return PortalAccountResource::collection($memberships);
    }

    public function store(StorePortalAccountRequest $request, Client $client): JsonResponse
    {
        $email = Str::lower($request->validated('email'));
        $identity = User::where('email', $email)->first();

        if (! $identity) {
            // BE-010 (DEC-020): invite-link flow. One pending client
            // invitation per email per client record.
            $pending = Invitation::where('email', $email)
                ->where('kind', Invitation::KIND_CLIENT)
                ->where('client_id', $client->id)
                ->whereNull('accepted_at')->whereNull('revoked_at')->exists();
            if ($pending) {
                throw new ApiException('INVITATION_PENDING', 422);
            }

            $invitation = new Invitation([
                'agency_id' => $client->agency_id,
                'email' => $email,
                'kind' => Invitation::KIND_CLIENT,
                'client_id' => $client->id,
                'role_ids' => [],
                'invited_by' => $request->user()->id,
            ]);
            $rawToken = $invitation->issueToken();
            $invitation->save();

            $invitation->loadMissing(['agency', 'inviter']);
            $acceptUrl = rtrim(config('app.frontend_url'), '/').'/portal/accept-invitation?token='.$rawToken;
            Mail::to($email)->send(new InvitationMail($invitation, $acceptUrl));

            return (new InvitationResource($invitation))
                ->response()->setStatusCode(201);
        }

        $membership = DB::transaction(function () use ($client, $identity) {
            // Design rule Q3: never both staff and client here.
            Membership::ensureNoKindConflict($identity->id, $client->agency_id, Membership::KIND_CLIENT);

            $existing = Membership::where('user_id', $identity->id)
                ->where('agency_id', $client->agency_id)
                ->where('kind', Membership::KIND_CLIENT)
                ->where('client_id', $client->id)
                ->first();
            if ($existing) {
                if ($existing->is_active) {
                    throw new ApiException('EMAIL_ALREADY_REGISTERED', 422);
                }
                $existing->forceFill([
                    'is_active' => true,
                    'deactivated_at' => null,
                    'deactivated_by' => null,
                ])->save();

                return $existing;
            }

            return Membership::create([
                'user_id' => $identity->id,
                'agency_id' => $client->agency_id,
                'kind' => Membership::KIND_CLIENT,
                'client_id' => $client->id,
                'is_active' => true,
            ]);
        });

        $membership->load('user');

        return PortalAccountResource::make($membership->refresh())
            ->response()->setStatusCode(201);
    }

    public function update(UpdatePortalAccountRequest $request, Client $client, int $accountId): PortalAccountResource
    {
        $membership = $client->portalAccounts()->findOrFail($accountId);
        $isActive = $request->validated('is_active');

        if ($isActive === false) {
            // Deactivation also revokes the membership's live tokens.
            $membership->deactivate($request->user()->id);
        } elseif ($isActive === true) {
            $membership->forceFill([
                'is_active' => true,
                'deactivated_at' => null,
                'deactivated_by' => null,
            ])->save();
        }

        $membership->load('user');

        return PortalAccountResource::make($membership);
    }
}
