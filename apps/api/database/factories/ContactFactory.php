<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\Contact;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Contact> */
class ContactFactory extends Factory
{
    public function definition(): array
    {
        return [
            // A contact is owned by a client or a lead (DEC-014); the agency
            // follows whichever owner is set.
            'agency_id' => fn (array $attrs) => isset($attrs['client_id'])
                ? Client::find($attrs['client_id'])?->agency_id
                : Lead::find($attrs['lead_id'] ?? null)?->agency_id,
            'client_id' => Client::factory(),
            'full_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'is_primary' => false,
        ];
    }
}
