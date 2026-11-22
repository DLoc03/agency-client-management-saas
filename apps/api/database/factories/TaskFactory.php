<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Task> */
class TaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Project::find($attrs['project_id'])?->agency_id,
            'project_id' => Project::factory(),
            'title' => fake()->sentence(4),
            'description' => fake()->sentence(),
            'status' => Task::STATUS_TODO,
            'priority' => Task::PRIORITY_MEDIUM,
            'position' => 0,
        ];
    }
}
