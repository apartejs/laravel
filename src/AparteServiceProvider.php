<?php

namespace Aparte\Laravel;

use Aparte\Laravel\Conversations\ConversationRepository;
use Aparte\Laravel\Conversations\DatabaseConversationRepository;
use Aparte\Laravel\Http\AssetController;
use Aparte\Laravel\Http\ChatController;
use Aparte\Laravel\Http\ConversationsController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AparteServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/aparte.php', 'aparte');

        // The app's own binding, made before or after this one, is the one that is used.
        $this->app->bindIf(ConversationRepository::class, DatabaseConversationRepository::class);
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'aparte');

        Route::macro('aparte', function (string $uri, string $agent) {
            return Route::post($uri, ChatController::class)->defaults('agent', $agent);
        });

        // The conversations a chat shows, kept for the person signed in: the list at `$uri`,
        // and one conversation at `$uri/{id}` (read, save, change, delete). Put them behind the
        // middleware that signs people in: a guest is answered 401.
        Route::macro('aparteConversations', function (string $uri) {
            $one = rtrim($uri, '/').'/{conversation}';

            Route::get($uri, [ConversationsController::class, 'index']);
            foreach (['get' => 'show', 'put' => 'store', 'patch' => 'update', 'delete' => 'destroy'] as $verb => $action) {
                Route::{$verb}($one, [ConversationsController::class, $action])->where('conversation', '[A-Za-z0-9._-]{1,64}');
            }
        });

        // Asked for, never run unasked: the table is only for an app that keeps conversations.
        $this->publishesMigrations([__DIR__.'/../database/migrations' => database_path('migrations')], 'aparte-migrations');
        $this->publishes([__DIR__.'/../config/aparte.php' => config_path('aparte.php')], 'aparte-config');

        // Served by a route, as Livewire serves its script: nothing to publish, and an
        // update of the package cannot leave an old copy behind in public/. No file extension
        // in the URL: a web server's static-file rule for *.js would answer it with a 404.
        Route::get('aparte-assets/{type}', AssetController::class)
            ->where('type', 'js|css')
            ->name('aparte.asset');
    }

    /** A cache-busting value that changes when the built file does. */
    public static function assetVersion(string $type): string
    {
        return (string) filemtime(__DIR__.'/../dist/aparte.'.$type);
    }
}
