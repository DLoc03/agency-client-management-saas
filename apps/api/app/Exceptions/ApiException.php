<?php

namespace App\Exceptions;

use Exception;

/**
 * Business error rendered in the standard API error format:
 * { error: { code, message, details? } } — see docs/AUTH_CONTRACT.md §4.
 * The message is translated from the error code via lang files.
 */
class ApiException extends Exception
{
    public function __construct(
        public readonly string $errorCode,
        public readonly int $status = 422,
        public readonly ?array $details = null,
    ) {
        parent::__construct($errorCode);
    }
}
