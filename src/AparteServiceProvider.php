<?php

namespace Aparte\Laravel;

use Aparte\Laravel\Conversations\ConversationRepository;
use Aparte\Laravel\Conversations\ConversationRoutes;
use Aparte\Laravel\Conversations\DatabaseConversationRepository;
use Aparte\Laravel\Http\AssetController;
use Aparte\Laravel\Http\ChatController;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AparteServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/aparte.php', 'aparte');

        // The app's own binding, made before or after this one, is the one that is used.
        $this->app->bindIf(ConversationRepository::class, DatabaseConversationRepository::class);

        // Here and not in boot(): routes are registered while providers boot, the app's and
        // those of other packages, in an order this package does not choose.
        Router::macro('aparte', function (string $uri, string $agent) {
            return Route::post($uri, ChatController::class)->defaults('agent', $agent);
        });

        // The conversations a chat shows, kept for the person signed in: the list at `$uri`,
        // and one conversation at `$uri/{id}` (read, save, change, delete). Put them behind the
        // middleware that signs people in: a guest is answered 401. `$scope` names the list:
        // two chats that must not share their conversations are given two.
        Router::macro('aparteConversations', function (string $uri, string $scope = 'default') {
            return ConversationRoutes::register($uri, $scope);
        });
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'aparte');

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

    /**
     * The id of the next chat a view draws: the one the view gives it (`id="support"`), else its
     * position on the page, per request, so that the same chat keeps its id, and its
     * conversation, from one load to the next.
     */
    public static function chatId(?string $given = null): string
    {
        $position = request()->attributes->get('aparte.chats', 0) + 1;
        request()->attributes->set('aparte.chats', $position);

        return $given !== null && $given !== '' ? $given : 'aparte-chat-'.$position;
    }

    /** A cache-busting value that changes when the built file does. */
    public static function assetVersion(string $type): string
    {
        return (string) filemtime(__DIR__.'/../dist/aparte.'.$type);
    }
}
