<?php

/**
 * Notification email strings (docs/WORKFLOW_CONTRACT.md section 7),
 * keyed by notification type. Only the section 5 email subset
 * (task.assigned, invoice.status_changed -> paid) is ever rendered;
 * the replacement params are the notification's `data` payload.
 */
return [
    'notifications' => [
        'task' => [
            'assigned' => [
                'subject' => 'You were assigned a task: :task_title',
                'body' => ':actor_name assigned you the task ":task_title". Open Brewbase to view it and get started.',
            ],
        ],
        'invoice' => [
            'status_changed' => [
                'subject' => 'Invoice :invoice_number is now :to_status',
                'body' => 'Invoice :invoice_number changed status from :from_status to :to_status.',
            ],
        ],
    ],
];
