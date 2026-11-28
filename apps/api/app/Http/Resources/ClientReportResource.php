<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the per-client revenue list
 * (docs/ANALYTICS_CONTRACT.md section 3.4). The aggregates are
 * computed by ReportController and attached as `report_*` attributes
 * (per the section 2 definitions) before the resource renders.
 */
class ClientReportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'status' => $this->status,
            'projects_count' => (int) ($this->projects_count ?? 0),
            'invoiced_total' => number_format((float) ($this->report_invoiced_total ?? 0), 2, '.', ''),
            'collected_total' => number_format((float) ($this->report_collected_total ?? 0), 2, '.', ''),
            'outstanding' => number_format((float) ($this->report_outstanding ?? 0), 2, '.', ''),
        ];
    }
}
