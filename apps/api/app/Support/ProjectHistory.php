<?php

namespace App\Support;

use App\Models\Invoice;
use App\Models\Project;
use Illuminate\Support\Collection;

/**
 * Communication history of one project, composed at read time
 * (docs/PORTAL_CONTRACT.md section 6, DEC-028 Q8): the Portal
 * discussion thread, the approval requests and their responses, and
 * the project's client-public invoice events are merged into one
 * newest-first feed. No activity table is written — the sources are
 * the records themselves, so the feed can never drift from them.
 *
 * The Portal and the internal side read the same event set: this is
 * the history of the exchange WITH the client, not an internal
 * audit log.
 */
class ProjectHistory
{
    /** @return Collection<int, array<string, mixed>> newest first */
    public static function forProject(Project $project): Collection
    {
        $events = collect();

        foreach ($project->portalComments()->with('author')->get() as $comment) {
            $events->push([
                'type' => 'comment',
                'occurred_at' => $comment->created_at,
                'comment_id' => $comment->id,
                'author' => $comment->author ? [
                    'id' => $comment->author->id,
                    'name' => $comment->author->name,
                ] : null,
                'author_kind' => $comment->author_kind,
                'body' => $comment->body,
            ]);
        }

        foreach ($project->approvalRequests()->with(['creator', 'responder'])->get() as $approval) {
            $events->push([
                'type' => 'approval_requested',
                'occurred_at' => $approval->created_at,
                'approval_id' => $approval->id,
                'approval_title' => $approval->title,
                'actor' => $approval->creator ? [
                    'id' => $approval->creator->id,
                    'name' => $approval->creator->name,
                ] : null,
            ]);

            if ($approval->responded_at) {
                $events->push([
                    'type' => 'approval_responded',
                    'occurred_at' => $approval->responded_at,
                    'approval_id' => $approval->id,
                    'approval_title' => $approval->title,
                    'decision' => $approval->status,
                    'actor' => $approval->responder ? [
                        'id' => $approval->responder->id,
                        'name' => $approval->responder->name,
                    ] : null,
                ]);
            }
        }

        // Only invoices the client can know about: issued (sent —
        // a derived-overdue invoice was issued too) and fully paid.
        // Drafts and cancelled invoices never appear.
        $invoices = $project->invoices()
            ->whereIn('status', [Invoice::STATUS_SENT, Invoice::STATUS_PAID])
            ->get();
        foreach ($invoices as $invoice) {
            $events->push([
                'type' => 'invoice_issued',
                'occurred_at' => $invoice->sent_at ?? $invoice->created_at,
                'invoice_id' => $invoice->id,
                'invoice_number' => $invoice->number,
                'amount' => $invoice->total,
            ]);

            if ($invoice->status === Invoice::STATUS_PAID && $invoice->paid_at) {
                $events->push([
                    'type' => 'invoice_paid',
                    'occurred_at' => $invoice->paid_at,
                    'invoice_id' => $invoice->id,
                    'invoice_number' => $invoice->number,
                    'amount' => $invoice->total,
                ]);
            }
        }

        return $events
            ->sortByDesc(fn (array $event) => $event['occurred_at']?->getTimestamp() ?? 0)
            ->map(fn (array $event) => [
                ...$event,
                'occurred_at' => $event['occurred_at']?->toISOString(),
            ])
            ->values();
    }

    /**
     * Paginate the composed feed with the standard pagination shape.
     *
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, int>}
     */
    public static function paginate(Project $project, int $page, int $perPage): array
    {
        $events = static::forProject($project);
        $total = $events->count();
        $lastPage = max(1, (int) ceil($total / $perPage));

        return [
            'data' => $events->forPage($page, $perPage)->values()->all(),
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'from' => $total === 0 ? 0 : ($page - 1) * $perPage + 1,
                'to' => min($total, $page * $perPage),
            ],
        ];
    }
}
