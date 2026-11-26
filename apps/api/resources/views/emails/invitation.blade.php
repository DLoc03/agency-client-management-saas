<!DOCTYPE html>
<html lang="en">
<body>
    <p>Hello,</p>
    @if ($invitation->kind === 'client')
    <p>{{ $invitation->inviter?->name ?? 'A workspace admin' }} at
       <strong>{{ $invitation->agency->name }}</strong> has invited you to access their
       Client Portal on Brewbase, where you can follow your projects, tasks and invoices.</p>
    <p><a href="{{ $acceptUrl }}">Set your password to access the Portal</a></p>
    @else
    <p>{{ $invitation->inviter?->name ?? 'A workspace admin' }} has invited you to join
       <strong>{{ $invitation->agency->name }}</strong> on Brewbase.</p>
    <p><a href="{{ $acceptUrl }}">Accept the invitation</a></p>
    @endif
    <p>This link expires at {{ $invitation->expires_at->toDayDateTimeString() }}.
       If you did not expect this invitation, you can ignore this email.</p>
</body>
</html>
