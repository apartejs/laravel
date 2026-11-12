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

    protected function defineDatabaseMigrations(): void
    {
        $this->loadMigrationsFrom(dirname(__DIR__).'/vendor/laravel/ai/database/migrations');
        $this->loadMigrationsFrom(dirname(__DIR__).'/database/migrations');
    }

    protected function defineRoutes($router): void
    {
        $router->aparte('/chat', TestAgent::class);
        $router->aparteConversations('/chat/conversations');
    }
}
