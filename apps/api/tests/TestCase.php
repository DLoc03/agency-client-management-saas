<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Feature tests share one application instance across requests, and the
     * Sanctum guard caches the resolved user. Forget guards before sending a
     * request with a different (or revoked) token so it is re-read from the
     * Authorization header — mirroring production, where each request is a
     * fresh process.
     */
    protected function withFreshToken(string $token): static
    {
        auth()->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }
}
