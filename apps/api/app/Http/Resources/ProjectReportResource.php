<?php

namespace App\Http\Resources;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * One row of the project performance report
 * (docs/ANALYTICS_CONTRACT.md section 3.3). The money and progress
 * figures delegate to the same model computations ProjectResource
 * exposes (invoicedTotal / collectedTotal / progressPercent and the
 * remaining-budget formula), so the report can never fork them.
 */
class ProjectReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $invoicedTotal = $this->invoicedTotal();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->name,
            ] : null,
            'status' => $this->status,
            'progress_percent' => $this->progressPercent(),
            'due_date' => $this->due_date?->toDateString(),
            'is_overdue' => $this->isOverdue(),
            'budget' => $this->budget,
            'invoiced_total' => number_format($invoicedTotal, 2, '.', ''),
            'collected_total' => number_format($this->collectedTotal(), 2, '.', ''),
            'remaining_budget' => $this->budget !== null
                ? number_format(round((float) $this->budget - $invoicedTotal, 2), 2, '.', '')
                : null,
        ];
    }

    /** Contract section 2: past due (agency timezone) and not completed/cancelled. */
    private function isOverdue(): bool
    {
        if (! $this->due_date || in_array($this->status, [Project::STATUS_COMPLETED, Project::STATUS_CANCELLED], true)) {
            return false;
        }

        $timezone = $this->agency?->timezone ?: config('app.timezone');

        return $this->due_date->toDateString() < Carbon::now($timezone)->toDateString();
    }
}
