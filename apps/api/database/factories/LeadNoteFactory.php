<?php

namespace Database\Factories;

use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<LeadNote> */
class LeadNoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Lead::find($attrs['lead_id'])?->agency_id,
            'lead_id' => Lead::factory(),
            'author_id' => User::factory(),
            'body' => fake()->sentence(),
        ];
    }
}
