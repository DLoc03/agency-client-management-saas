<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class AgencyFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(100, 999),
            'base_currency' => 'USD',
            'timezone' => 'UTC',
            'is_locked' => false,
        ];
    }

    public function locked(): static
    {
        return $this->state(fn () => ['is_locked' => true]);
    }
}
