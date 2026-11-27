<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Deadline reminders (docs/WORKFLOW_CONTRACT.md section 6, DEC-026
// decision Q5): one scheduler run at 01:00 UTC (= 08:00 Asia/Saigon);
// each agency's rules are evaluated in that agency's own timezone
// inside the command.
Schedule::command('reminders:run')->dailyAt('01:00');
