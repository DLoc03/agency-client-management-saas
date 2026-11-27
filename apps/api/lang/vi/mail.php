<?php

/**
 * Chuỗi email thông báo (docs/WORKFLOW_CONTRACT.md mục 7), khóa theo
 * loại thông báo. Chỉ nhóm email ở mục 5 (task.assigned,
 * invoice.status_changed -> paid) mới được render; tham số thay thế
 * là payload `data` của thông báo.
 */
return [
    'notifications' => [
        'task' => [
            'assigned' => [
                'subject' => 'Bạn được giao một công việc: :task_title',
                'body' => ':actor_name đã giao cho bạn công việc ":task_title". Mở Brewbase để xem và bắt đầu làm.',
            ],
        ],
        'invoice' => [
            'status_changed' => [
                'subject' => 'Hoá đơn :invoice_number hiện đã :to_status',
                'body' => 'Hoá đơn :invoice_number đã đổi trạng thái từ :from_status sang :to_status.',
            ],
        ],
    ],
];
