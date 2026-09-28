<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Guards for the test environment itself.
 *
 * This project runs the suite inside Docker, where the container exports real
 * environment variables (DB_CONNECTION=mysql, CACHE_STORE=redis, ...). If those
 * were ever allowed to win over phpunit.xml, RefreshDatabase would migrate --
 * and therefore wipe -- the development database. These assertions fail loudly
 * if that isolation is ever broken.
 */
class TestingEnvironmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_suite_runs_against_an_in_memory_sqlite_database(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
    }

    public function test_the_development_database_is_not_reachable_from_tests(): void
    {
        $this->assertNotSame('toy_store_db', config('database.connections.mysql.database'));
        $this->assertSame(':memory:', config('database.connections.mysql.database'));
    }

    public function test_cache_queue_and_session_are_isolated_from_the_stack(): void
    {
        $this->assertTrue(app()->environment('testing'));
        $this->assertSame('array', config('cache.default'));
        $this->assertSame('sync', config('queue.default'));
        $this->assertSame('array', config('session.driver'));
    }

    public function test_the_log_sms_gateway_is_selected_by_default(): void
    {
        $this->assertSame('log', config('sms.default'));
    }
}
