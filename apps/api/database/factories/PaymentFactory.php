<?php

namespace Database\Factories;

use App\Models\Agency;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'agency_id' => Agency::factory(),
            'invoice_id' => Invoice::factory(),
            'amount' => fake()->randomFloat(2, 50, 1000),
            'paid_on' => now()->toDateString(),
            'method' => Payment::METHOD_BANK_TRANSFER,
            'recorded_by' => User::factory(),
        ];
    }
}
