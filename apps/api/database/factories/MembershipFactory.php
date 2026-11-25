<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Membership;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Membership>
 */
class MembershipFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'agency_id' => Agency::factory(),
            'kind' => Membership::KIND_STAFF,
            'client_id' => null,
            'is_active' => true,
        ];
    }

    public function client(): static
    {
        return $this->state(fn (array $attributes) => [
            'kind' => Membership::KIND_CLIENT,
        ]);
    }
}
