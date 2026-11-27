<!DOCTYPE html>
<html lang="en">
<body>
    <p>Hello {{ $recipientName }},</p>
    <p>{{ __('mail.notifications.'.$type.'.body', $data) }}</p>
    @if ($agencyName)
    <p>— {{ $agencyName }} on Brewbase</p>
    @else
    <p>— Brewbase</p>
    @endif
</body>
</html>
