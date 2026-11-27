<?php

namespace App\Jobs;

use App\Mail\NotificationMail;
use App\Models\Agency;
use App\Models\User;
use App\Support\Tenant;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

/**
 * Delivers one notification email (docs/WORKFLOW_CONTRACT.md section
 * 5). Per AGENTS.md tenant rule 5 the payload carries `agency_id`
 * and the work runs inside Tenant::run(); the mailable is rendered in
 * the recipient identity's stored locale, like API messages.
 */
class SendNotificationMail implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $userId,
        public readonly int $agencyId,
        public readonly string $type,
        public readonly array $data,
    ) {}

    public function handle(): void
    {
        Tenant::run($this->agencyId, function () {
            $user = User::find($this->userId);
            if (! $user) {
                return;
            }

            $agency = Agency::find($this->agencyId);

            Mail::to($user)
                ->locale($user->locale ?: 'en')
                ->send(new NotificationMail($this->type, $this->data, $user->name, $agency?->name));
        });
    }
}
