<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * A client invoice (docs/FINANCE_CONTRACT.md, DEC-019). Totals are
 * stored at create/update time and never recomputed at read; only
 * "overdue" is derived at read (section 4.3), like project progress.
 */
class Invoice extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const STATUS_DRAFT = 'draft';

    public const STATUS_SENT = 'sent';

    public const STATUS_PAID = 'paid';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_OVERDUE = 'overdue';

    /** Stored statuses (the only values the column ever holds). */
    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SENT,
        self::STATUS_PAID,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'agency_id', 'client_id', 'project_id', 'number', 'status',
        'issue_date', 'due_date', 'tax_rate', 'subtotal', 'tax_amount',
        'total', 'notes', 'sent_at', 'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'tax_rate' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('paid_on')->latest('id');
    }

    /**
     * Next invoice number for the agency + year: INV-{YYYY}-{seq}, the
     * sequence counting every number ever issued for that year —
     * including soft-deleted invoices, so numbers are never reused
     * (contract 4.1). The explicit agency_id filter (taken from the
     * tenant context, never from client input) is what makes the
     * unscoped count safe.
     */
    public static function nextNumber(int $agencyId, int $year): string
    {
        $issued = static::withoutGlobalScope('agency')
            ->withTrashed()
            ->where('agency_id', $agencyId)
            ->where('number', 'like', "INV-{$year}-%")
            ->count();

        return sprintf('INV-%d-%04d', $year, $issued + 1);
    }

    /** Sum of the invoice's live (non-soft-deleted) payments. */
    public function paidTotal(): float
    {
        if (isset($this->payments_sum_amount)) {
            return round((float) $this->payments_sum_amount, 2);
        }

        return round((float) $this->payments()->sum('amount'), 2);
    }

    public function balanceDue(): float
    {
        return round((float) $this->total - $this->paidTotal(), 2);
    }

    /**
     * API-facing status: a stored "sent" invoice past its due date with
     * a balance still due reads as "overdue" (contract 4.3). The due
     * comparison uses the workspace timezone's current date.
     */
    public function derivedStatus(): string
    {
        if ($this->status !== self::STATUS_SENT || ! $this->due_date) {
            return $this->status;
        }

        $timezone = $this->agency?->timezone ?: config('app.timezone');
        $today = Carbon::now($timezone)->toDateString();

        return $this->due_date->toDateString() < $today && $this->balanceDue() > 0
            ? self::STATUS_OVERDUE
            : $this->status;
    }

    public function isOverdue(): bool
    {
        return $this->derivedStatus() === self::STATUS_OVERDUE;
    }

    /**
     * Recompute the stored totals from the current line items
     * (contract 4.2): subtotal is the sum of item amounts, tax is the
     * single invoice rate over the subtotal, each step rounded half-up
     * to 2 decimals. Call inside the writing transaction, then save.
     */
    public function recomputeTotals(): void
    {
        $subtotal = round((float) $this->items()->sum('amount'), 2);
        $taxAmount = $this->tax_rate === null
            ? 0.0
            : round($subtotal * (float) $this->tax_rate / 100, 2);

        $this->subtotal = $subtotal;
        $this->tax_amount = $taxAmount;
        $this->total = round($subtotal + $taxAmount, 2);
    }

    /**
     * Keep the stored status in step with the payments (contract 4.4):
     * full coverage moves Sent → Paid and stamps paid_at; a balance
     * reappearing (a payment was deleted to correct an error) moves
     * Paid back to Sent and clears paid_at.
     */
    public function refreshStatusFromPayments(): void
    {
        if ($this->status === self::STATUS_SENT && $this->paidTotal() > 0 && $this->balanceDue() <= 0) {
            $this->forceFill(['status' => self::STATUS_PAID, 'paid_at' => now()])->save();
        } elseif ($this->status === self::STATUS_PAID && $this->balanceDue() > 0) {
            $this->forceFill(['status' => self::STATUS_SENT, 'paid_at' => null])->save();
        }
    }
}
