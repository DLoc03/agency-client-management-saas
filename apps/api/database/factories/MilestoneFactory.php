<?php

namespace Database\Factories;

use App\Models\Milestone;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Milestone> */
class MilestoneFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Project::find($attrs['project_id'])?->agency_id,
            'project_id' => Project::factory(),
            'name' => fake()->words(2, true),
            'due_date' => fake()->dateTimeBetween('now', '+2 months'),
            'status' => Milestone::STATUS_PLANNED,
        ];
    }
}
