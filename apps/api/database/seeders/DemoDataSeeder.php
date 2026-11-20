<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\ClientAccount;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Local demo data only. Runs when SEED_DEMO_DATA=true (see DatabaseSeeder).
 * Demo credentials (local only, never production):
 *   Owner:  owner@demo.test / password
 *   Client: client@demo.test / password
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $agency = Agency::firstOrCreate(
            ['slug' => 'demo-agency'],
            ['name' => 'Demo Agency', 'base_currency' => 'USD', 'timezone' => 'Asia/Ho_Chi_Minh']
        );

        $owner = User::firstOrCreate(
            ['email' => 'owner@demo.test'],
            [
                'agency_id' => $agency->id,
                'name' => 'Demo Owner',
                'password' => Hash::make('password'),
                'locale' => 'en',
            ]
        );
        $owner->roles()->syncWithoutDetaching(
            Role::whereIn('key', [Role::OWNER])->pluck('id')
        );

        ClientAccount::firstOrCreate(
            ['email' => 'client@demo.test'],
            [
                'agency_id' => $agency->id,
                'name' => 'Demo Client',
                'password' => Hash::make('password'),
                'locale' => 'en',
            ]
        );
    }
}
