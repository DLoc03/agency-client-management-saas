<?php

namespace Database\Factories;

use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<TaskComment> */
class TaskCommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Task::find($attrs['task_id'])?->agency_id,
            'task_id' => Task::factory(),
            'author_id' => User::factory(),
            'body' => fake()->sentence(),
        ];
    }
}
