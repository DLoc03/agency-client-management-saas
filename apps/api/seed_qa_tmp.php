<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Agency;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

$a1 = Agency::firstOrCreate(['slug'=>'demo-agency'], ['name'=>'Demo Agency','base_currency'=>'USD','timezone'=>'Asia/Ho_Chi_Minh']);
function makeUser($email,$name,$agency,$roleKey) {
    $u = User::firstOrCreate(['email'=>$email], ['agency_id'=>$agency->id,'name'=>$name,'password'=>Hash::make('password'),'locale'=>'en','is_active'=>true]);
    $role = Role::where('key',$roleKey)->first();
    $u->roles()->sync([$role->id]);
    return $u;
}
makeUser('owner@demo.test','Demo Owner',$a1,'agency_owner');
makeUser('admin@demo.test','Demo Admin',$a1,'admin');
makeUser('sales@demo.test','Demo Sales',$a1,'sales_manager');
makeUser('pm@demo.test','Demo PM',$a1,'project_manager');
makeUser('accountant@demo.test','Demo Accountant',$a1,'accountant');
makeUser('team@demo.test','Demo Team',$a1,'team_member');

$a2 = Agency::firstOrCreate(['slug'=>'foreign-agency'], ['name'=>'Foreign Agency','base_currency'=>'USD','timezone'=>'Asia/Ho_Chi_Minh']);
makeUser('foreign@demo.test','Foreign User',$a2,'agency_owner');
echo "done\n";
?>