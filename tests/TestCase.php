<?php

namespace Aparte\Laravel\Tests;

use Aparte\Laravel\AparteServiceProvider;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Laravel\Ai\AiServiceProvider;
use Orchestra\Testbench\TestCase as BaseTestCase;

class TestCase extends BaseTestCase
{
    protected function getPackageProviders($app): array
    {
        return [AiServiceProvider::class, AparteServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        // Never the workbench's own database: `workbench:build` leaves a file where Testbench
        // looks for one, and a run of the tests would use it, then empty it on its way out.
        if ($app['config']->get('database.default') === 'sqlite') {
            $app['config']->set('database.connections.sqlite.database', ':memory:');
        }
    }

    protected function defineDatabaseMigrations(): void
    {
        $this->loadMigrationsFrom(dirname(__DIR__).'/vendor/laravel/ai/database/migrations');
        $this->loadMigrationsFrom(dirname(__DIR__).'/database/migrations');
    }

    protected function defineRoutes($router): void
    {
        $router->aparte('/chat', TestAgent::class);
        $router->aparteConversations('/chat/conversations');
        // A second chat of the same app, with a list of its own.
        $router->aparteConversations('/help/conversations', 'help');
    }
}
