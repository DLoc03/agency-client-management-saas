<?php

namespace Database\Factories;

use App\Models\Lead;
use App\Models\LeadActivity;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<LeadActivity> */
class LeadActivityFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Lead::find($attrs['lead_id'])?->agency_id,
            'lead_id' => Lead::factory(),
            'type' => fake()->randomElement(LeadActivity::TYPES),
            'scheduled_at' => now()->addDays(2),
            'note' => fake()->sentence(),
            'is_done' => false,
            'created_by' => User::factory(),
        ];
    }
}
