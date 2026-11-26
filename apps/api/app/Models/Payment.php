<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAgency;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A manually recorded payment on an invoice (docs/FINANCE_CONTRACT.md
 * section 4.4). Soft-deleting a payment is an error correction: the
 * invoice balance and status are recomputed afterwards.
 */
class Payment extends Model
{
    use BelongsToAgency, HasFactory, SoftDeletes;

    public const METHOD_BANK_TRANSFER = 'bank_transfer';

    public const METHOD_CASH = 'cash';

    public const METHODS = [
        self::METHOD_BANK_TRANSFER,
        self::METHOD_CASH,
    ];

    protected $fillable = [
        'agency_id', 'invoice_id', 'amount', 'paid_on', 'method', 'note', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_on' => 'date',
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
