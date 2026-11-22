<!DOCTYPE html>
<html lang="en">
<body>
    <p>Hello,</p>
    <p>{{ $invitation->inviter?->name ?? 'A workspace admin' }} has invited you to join
       <strong>{{ $invitation->agency->name }}</strong> on Brewbase.</p>
    <p><a href="{{ $acceptUrl }}">Accept the invitation</a></p>
    <p>This link expires at {{ $invitation->expires_at->toDayDateTimeString() }}.
       If you did not expect this invitation, you can ignore this email.</p>
</body>
</html>
