<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Values that must hold for every test, regardless of how the suite is
     * launched (Docker, host, CI, IDE).
     *
     * @var array<string, string>
     */
    private const ISOLATED_ENVIRONMENT = [
        'APP_ENV' => 'testing',
        'DB_CONNECTION' => 'sqlite',
        'DB_DATABASE' => ':memory:',
        'DB_URL' => '',
        'CACHE_STORE' => 'array',
        'SESSION_DRIVER' => 'array',
        'QUEUE_CONNECTION' => 'sync',
        'MAIL_MAILER' => 'array',
        'BCRYPT_ROUNDS' => '4',
        'SMS_GATEWAY' => 'log',
    ];

    protected function setUp(): void
    {
        $this->useIsolatedEnvironment();

        parent::setUp();
    }

    /**
     * Force the test environment *before* the application is created.
     *
     * phpunit.xml already declares these variables, but this project also
     * exports them as real container environment variables through
     * docker-compose. Laravel's Env repository resolves $_SERVER before $_ENV,
     * and PHPUnit's <env> entries — even with force="true" — do not update
     * $_SERVER. Without this step the stack values win: the suite would run on
     * MySQL and the array cache would be replaced by Redis, so RefreshDatabase
     * would migrate (and wipe) the development database and rate-limit state
     * would leak between tests. tests/Feature/TestingEnvironmentTest.php asserts
     * that this isolation is in place.
     */
    private function useIsolatedEnvironment(): void
    {
        foreach (self::ISOLATED_ENVIRONMENT as $key => $value) {
            putenv("{$key}={$value}");

            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}
