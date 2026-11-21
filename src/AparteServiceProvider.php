<?php

namespace Aparte\Laravel;

use Aparte\Laravel\ChatModels;
use Aparte\Laravel\Conversations\ConversationRepository;
use Aparte\Laravel\Conversations\ConversationRoutes;
use Aparte\Laravel\Conversations\DatabaseConversationRepository;
use Aparte\Laravel\Conversations\PeopleRoutes;
use Aparte\Laravel\Conversations\ShownBranch;
use Aparte\Laravel\Conversations\ShownBranchStore;
use Aparte\Laravel\Http\AssetController;
use Aparte\Laravel\Http\ChatController;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Laravel\Ai\Contracts\ConversationStore;
use Laravel\Ai\Storage\DatabaseConversationStore;

class AparteServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/aparte.php', 'aparte');

        // The app's own binding, made before or after this one, is the one that is used.
        $this->app->bindIf(ConversationRepository::class, DatabaseConversationRepository::class);

        // The model's memory follows the branch the person sees (ShownBranchStore): the SDK's own store, with that
        // added. A store the app binds of its own is left as it is.
        $this->app->scoped(ShownBranch::class);
        $this->app->extend(ConversationStore::class, fn (ConversationStore $store): ConversationStore => $store::class === DatabaseConversationStore::class
            ? ShownBranchStore::following($store)
            : $store);

        // Here and not in boot(): routes are registered while providers boot, the app's and
        // those of other packages, in an order this package does not choose.
        // `$models`: the person chooses the model among config `aparte.models` (`true`) or this route's own list
        // (ChatModels). A route that offers no choice takes none.
        Router::macro('aparte', function (string $uri, string $agent, bool|array $models = false) {
            return ChatModels::offer(Route::post($uri, ChatController::class)->defaults('agent', $agent), $models);
        });

        // The conversations a chat shows, kept for the person signed in: the list at `$uri`,
        // and one conversation at `$uri/{id}` (read, save, change, delete). Put them behind the
        // middleware that signs people in: a guest is answered 401. `$scope` names the list:
        // two chats that must not share their conversations are given two.
        Router::macro('aparteConversations', function (string $uri, string $scope = 'default') {
            return ConversationRoutes::register($uri, $scope);
        });

        // For a chat someone of your team can take over (People): who holds a conversation at
        // `$uri/{id}`, and what the person writes meanwhile at `$uri/{id}/messages`. Give them the
        // middleware the chat route has, so the same person is recognised.
        Router::macro('apartePeople', function (string $uri) {
            return PeopleRoutes::register($uri);
        });
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'aparte');
        // What the chat says, in the languages aparté speaks; the app's own lang/*.json wins.
        $this->loadJsonTranslationsFrom(__DIR__.'/../lang');

        // The people routes answer guests: each POST is counted by IP (config `aparte.people.throttle`).
        \Illuminate\Support\Facades\RateLimiter::for('aparte-people', fn (\Illuminate\Http\Request $request) => self::peopleLimit($request, 1));
        \Illuminate\Support\Facades\RateLimiter::for('aparte-people-presence', fn (\Illuminate\Http\Request $request) => self::peopleLimit($request, 5));

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

    /** What one IP may post a minute to the people routes; `$times` more for typing and "seen". */
    private static function peopleLimit(\Illuminate\Http\Request $request, int $times): \Illuminate\Cache\RateLimiting\Limit
    {
        $perMinute = config('aparte.people.throttle', 20);

        return $perMinute === null
            ? \Illuminate\Cache\RateLimiting\Limit::none()
            : \Illuminate\Cache\RateLimiting\Limit::perMinute(max(1, (int) $perMinute) * $times)->by((string) $request->ip());
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
