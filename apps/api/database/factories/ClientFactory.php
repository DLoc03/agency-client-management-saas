<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Client;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Client> */
class ClientFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'name' => fake()->company(),
            'type' => Client::TYPE_COMPANY,
            'status' => Client::STATUS_ACTIVE,
            'email' => fake()->companyEmail(),
            'phone' => fake()->phoneNumber(),
            'website' => fake()->url(),
        ];
    }
}
