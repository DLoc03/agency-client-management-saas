<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $invoice->number }}</title>
<style>
    body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1a1a1a; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 2px 0; }
    h2 { font-size: 13px; margin: 18px 0 6px 0; }
    .muted { color: #666; }
    .agency { font-size: 15px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f2f2f2; }
    .num { text-align: right; }
    .totals { width: 45%; margin-left: 55%; margin-top: 10px; }
    .totals td { border: none; padding: 3px 8px; }
    .totals .grand td { border-top: 1px solid #999; font-weight: bold; }
    .watermark {
        position: fixed; top: 38%; left: 0; width: 100%;
        text-align: center; font-size: 64px; font-weight: bold;
        color: #e3e3e3; z-index: -1;
    }
    .overdue-note { color: #b00020; font-weight: bold; margin-top: 6px; }
    .bank { border: 1px solid #ccc; padding: 8px 10px; margin-top: 8px; }
</style>
</head>
<body>
@if ($invoice->status === 'draft')
    <div class="watermark">DRAFT</div>
@elseif ($invoice->status === 'cancelled')
    <div class="watermark">CANCELLED</div>
@endif

<div class="agency">{{ $invoice->agency->name }}</div>
<h1>Invoice {{ $invoice->number }}</h1>
<div class="muted">
    Status: {{ strtoupper($invoice->derivedStatus()) }}<br>
    Issue date: {{ $invoice->issue_date?->toDateString() }}
    @if ($invoice->due_date) &nbsp;|&nbsp; Due date: {{ $invoice->due_date->toDateString() }} @endif
</div>
@if ($invoice->isOverdue())
    <div class="overdue-note">This invoice is overdue.</div>
@endif

<h2>Billed to</h2>
<div>
    {{ $invoice->client->name }}
    @if ($invoice->project)
        <br><span class="muted">Project: {{ $invoice->project->name }}</span>
    @endif
</div>

<table>
    <thead>
        <tr>
            <th>Description</th>
            <th class="num" style="width: 12%;">Qty</th>
            <th class="num" style="width: 18%;">Unit price</th>
            <th class="num" style="width: 18%;">Amount</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($invoice->items as $item)
            <tr>
                <td>{{ $item->description }}</td>
                <td class="num">{{ number_format((float) $item->quantity, 2) }}</td>
                <td class="num">{{ number_format((float) $item->unit_price, 2) }}</td>
                <td class="num">{{ number_format((float) $item->amount, 2) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table class="totals">
    <tr>
        <td>Subtotal</td>
        <td class="num">{{ number_format((float) $invoice->subtotal, 2) }}</td>
    </tr>
    @if ($invoice->tax_rate !== null)
        <tr>
            <td>Tax ({{ number_format((float) $invoice->tax_rate, 2) }}%)</td>
            <td class="num">{{ number_format((float) $invoice->tax_amount, 2) }}</td>
        </tr>
    @endif
    <tr class="grand">
        <td>Total</td>
        <td class="num">{{ number_format((float) $invoice->total, 2) }}</td>
    </tr>
    <tr>
        <td>Paid</td>
        <td class="num">{{ number_format($paidTotal, 2) }}</td>
    </tr>
    <tr class="grand">
        <td>Balance due</td>
        <td class="num">{{ number_format($balanceDue, 2) }}</td>
    </tr>
</table>

@if ($invoice->notes)
    <h2>Notes</h2>
    <div>{{ $invoice->notes }}</div>
@endif

@if ($invoice->agency->bank_name || $invoice->agency->bank_account_number || $invoice->agency->vietqr_payload)
    <h2>Payment details</h2>
    <div class="bank">
        @if ($invoice->agency->bank_name)
            Bank: {{ $invoice->agency->bank_name }}<br>
        @endif
        @if ($invoice->agency->bank_account_number)
            Account number: {{ $invoice->agency->bank_account_number }}<br>
        @endif
        @if ($invoice->agency->bank_account_holder)
            Account holder: {{ $invoice->agency->bank_account_holder }}<br>
        @endif
        @if ($invoice->agency->vietqr_payload)
            VietQR: {{ $invoice->agency->vietqr_payload }}
        @endif
    </div>
@endif
</body>
</html>
