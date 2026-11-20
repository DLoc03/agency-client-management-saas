<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call(RoleSeeder::class);

        // Local demo data is opt-in: SEED_DEMO_DATA=true in .env (local only).
        if (app()->environment('local') && env('SEED_DEMO_DATA', false)) {
            $this->call(DemoDataSeeder::class);
        }
    }
}
