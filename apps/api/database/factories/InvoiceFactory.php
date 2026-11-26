<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'client_id' => Client::factory(),
            'project_id' => null,
            'number' => 'INV-'.now()->format('Y').'-'.fake()->unique()->numerify('####'),
            'status' => Invoice::STATUS_DRAFT,
            'issue_date' => now()->toDateString(),
            'due_date' => now()->addDays(14)->toDateString(),
            'tax_rate' => null,
            'subtotal' => 0,
            'tax_amount' => 0,
            'total' => 0,
        ];
    }

    public function sent(): static
    {
        return $this->state(fn () => [
            'status' => Invoice::STATUS_SENT,
            'sent_at' => now(),
        ]);
    }
}
