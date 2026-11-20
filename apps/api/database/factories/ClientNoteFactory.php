<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\ClientNote;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ClientNote> */
class ClientNoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => fn (array $attrs) => Client::find($attrs['client_id'])?->agency_id,
            'client_id' => Client::factory(),
            'author_id' => User::factory(),
            'body' => fake()->sentence(),
        ];
    }
}
