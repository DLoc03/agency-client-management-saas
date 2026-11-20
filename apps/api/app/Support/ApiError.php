<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

class ApiError
{
    /** Standard error response body (docs/AUTH_CONTRACT.md §4). */
    public static function respond(string $code, int $status, ?array $details = null): JsonResponse
    {
        $error = [
            'code' => $code,
            'message' => __("api.$code"),
        ];
        if ($details !== null) {
            $error['details'] = $details;
        }

        return response()->json(['error' => $error], $status);
    }
}
