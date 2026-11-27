<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The one notification email (docs/WORKFLOW_CONTRACT.md section 5):
 * subject and body come from `lang/{locale}/mail.php`, keyed by the
 * notification type, with the notification `data` as the replacement
 * params. Only the email subset of types ever reaches this mailable.
 */
class NotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $type,
        public readonly array $data,
        public readonly string $recipientName,
        public readonly ?string $agencyName = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: __('mail.notifications.'.$this->type.'.subject', $this->data),
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.notification');
    }
}
