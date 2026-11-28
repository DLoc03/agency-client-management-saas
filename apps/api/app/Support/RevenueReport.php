<?php

namespace App\Support;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Carbon;

/**
 * The Group 8 revenue figures (docs/ANALYTICS_CONTRACT.md sections 2
 * and 3.2). One code path feeds the JSON revenue report, the CSV
 * export and the dashboard finance section, so the three renderings
 * can never disagree.
 *
 * Definitions (contract section 2): collected is cash-basis — payments
 * summed by `paid_on`, with no invoice-status filter; invoiced sums
 * invoice totals by `issue_date`, excluding stored status `cancelled`
 * (drafts deliberately included, contract section 7); outstanding is
 * a current snapshot over stored-status `sent` invoices.
 */
class RevenueReport
{
    /**
     * Monthly rows for an inclusive agency-local date range. Every
     * month intersecting the range appears exactly once, zero-filled,
     * oldest first.
     *
     * @return array{
     *     months: list<array{month: string, invoiced: string, collected: string}>,
     *     totals: array{invoiced: string, collected: string},
     *     outstanding_total: string
     * }
     */
    public static function build(string $from, string $to): array
    {
        // The bounds are Carbon day edges, not plain date strings:
        // `date`-cast columns can carry a `00:00:00` suffix in
        // storage (SQLite), and a plain `Y-m-d` upper bound would
        // string-compare below the range's own last day.
        $fromEdge = Carbon::parse($from)->startOfDay();
        $toEdge = Carbon::parse($to)->endOfDay();

        $invoicedByMonth = self::monthlySums(
            Invoice::query()
                ->where('status', '!=', Invoice::STATUS_CANCELLED)
                ->whereBetween('issue_date', [$fromEdge, $toEdge]),
            'issue_date',
            'total',
        );
        $collectedByMonth = self::monthlySums(
            Payment::query()->whereBetween('paid_on', [$fromEdge, $toEdge]),
            'paid_on',
            'amount',
        );

        $months = [];
        $totalInvoiced = 0.0;
        $totalCollected = 0.0;
        $cursor = Carbon::parse($from)->startOfMonth();
        $lastMonth = Carbon::parse($to)->startOfMonth();
        while ($cursor->lte($lastMonth)) {
            $label = $cursor->format('Y-m');
            $invoiced = round($invoicedByMonth[$label] ?? 0, 2);
            $collected = round($collectedByMonth[$label] ?? 0, 2);
            $months[] = [
                'month' => $label,
                'invoiced' => number_format($invoiced, 2, '.', ''),
                'collected' => number_format($collected, 2, '.', ''),
            ];
            $totalInvoiced += $invoiced;
            $totalCollected += $collected;
            $cursor->addMonth();
        }

        return [
            'months' => $months,
            'totals' => [
                'invoiced' => number_format(round($totalInvoiced, 2), 2, '.', ''),
                'collected' => number_format(round($totalCollected, 2), 2, '.', ''),
            ],
            'outstanding_total' => number_format(self::outstandingTotal(), 2, '.', ''),
        ];
    }

    /**
     * Current outstanding snapshot (contract section 2): the balance
     * due over every stored-status `sent` invoice (derived-overdue
     * invoices are stored `sent`, so they are included).
     */
    public static function outstandingTotal(): float
    {
        return round((float) Invoice::query()
            ->where('status', Invoice::STATUS_SENT)
            ->withSum('payments', 'amount')
            ->get()
            ->sum(fn (Invoice $invoice) => $invoice->balanceDue()), 2);
    }

    /**
     * Sum an amount column per calendar month of a date column. The
     * grouping runs on the full date and is bucketed in PHP, which
     * keeps the query free of DB-specific date functions (SQLite /
     * MySQL parity).
     *
     * @return array<string, float> month label (`Y-m`) => summed amount
     */
    private static function monthlySums($query, string $dateColumn, string $amountColumn): array
    {
        $rows = $query
            ->selectRaw("{$dateColumn} as bucket_date, SUM({$amountColumn}) as bucket_sum")
            ->groupBy($dateColumn)
            ->pluck('bucket_sum', 'bucket_date');

        $byMonth = [];
        foreach ($rows as $date => $sum) {
            $month = substr((string) $date, 0, 7);
            $byMonth[$month] = ($byMonth[$month] ?? 0.0) + (float) $sum;
        }

        return $byMonth;
    }
}
