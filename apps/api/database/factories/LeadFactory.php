<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Lead> */
class LeadFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'name' => fake()->words(3, true),
            'company_name' => fake()->company(),
            'contact_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'source' => fake()->randomElement(Lead::SOURCES),
            'status' => Lead::STATUS_NEW,
            'estimated_value' => fake()->randomFloat(2, 500, 50000),
        ];
    }
}
