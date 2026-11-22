<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Project> */
class ProjectFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'client_id' => Client::factory(),
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'status' => Project::STATUS_DRAFT,
            'budget' => fake()->randomFloat(2, 1000, 100000),
        ];
    }
}
