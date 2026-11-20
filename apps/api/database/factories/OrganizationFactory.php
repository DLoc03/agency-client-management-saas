<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Organization> */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Client::find($attrs['client_id'])?->agency_id,
            'client_id' => Client::factory(),
            'legal_name' => fake()->company().' Co., Ltd',
            'industry' => fake()->word(),
        ];
    }
}
