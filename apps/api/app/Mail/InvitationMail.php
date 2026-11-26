<?php

namespace App\Mail;

use App\Models\Invitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Workspace invitation email (docs/TEAM_CONTRACT.md section 4). */
class InvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Invitation $invitation,
        public readonly string $acceptUrl,
    ) {}

    public function envelope(): Envelope
    {
        // BE-010 (DEC-020): one mail template serves both kinds; the
        // client variant speaks about Portal access and setting a
        // password, per the Product Owner's decision of 2026-11-26.
        $subject = $this->invitation->kind === Invitation::KIND_CLIENT
            ? 'You are invited to the Client Portal of '.$this->invitation->agency->name.' on Brewbase'
            : 'You are invited to join '.$this->invitation->agency->name.' on Brewbase';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.invitation');
    }
}
