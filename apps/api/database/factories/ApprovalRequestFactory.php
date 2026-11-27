<?php

namespace Database\Factories;

use App\Models\ApprovalRequest;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ApprovalRequest> */
class ApprovalRequestFactory extends Factory
{
    protected $model = ApprovalRequest::class;

    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Project::find($attrs['project_id'])?->agency_id,
            'project_id' => Project::factory(),
            'file_id' => null,
            'milestone_id' => null,
            'title' => fake()->sentence(4),
            'description' => fake()->sentence(),
            'created_by' => User::factory(),
            'status' => ApprovalRequest::STATUS_PENDING,
            'response_comment' => null,
            'responded_by' => null,
            'responded_at' => null,
        ];
    }
}
