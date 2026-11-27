<?php

/*
 * Client Portal & Collaboration settings (docs/PORTAL_CONTRACT.md,
 * DEC-028 Q4). The file-sharing limits live here so they can be tuned
 * through the environment without a code change.
 */
return [
    'files' => [
        // Private disk (config/filesystems.php): files are never
        // publicly reachable, downloads stream through the API.
        'disk' => env('PORTAL_FILE_DISK', 'local'),
        // 20 MB per file by default.
        'max_size_kb' => (int) env('PORTAL_FILE_MAX_SIZE_KB', 20480),
        'extensions' => array_values(array_filter(array_map(
            'trim',
            explode(',', env('PORTAL_FILE_EXTENSIONS', 'pdf,doc,docx,xls,xlsx,ppt,pptx,zip,png,jpg,jpeg,txt,csv'))
        ))),
    ],
];
