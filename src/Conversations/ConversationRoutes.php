<?php

namespace Aparte\Laravel\Conversations;

use Aparte\Laravel\Http\ConversationsController;
use Illuminate\Routing\Route as RegisteredRoute;
use Illuminate\Support\Facades\Route;
use InvalidArgumentException;

/**
 * The five routes that keep a chat's conversations, as `Route::aparteConversations()` registers
 * them: the list at `$uri`, and one conversation at `$uri/{id}` (read, save, change, delete).
 * What it gives back takes the middleware of the app, for the five at once:
 * `Route::aparteConversations('/chat/conversations')->middleware('auth')`.
 */
class ConversationRoutes
{
    /** @param  list<RegisteredRoute>  $routes */
    private function __construct(private array $routes) {}

    /**
     * @param  string  $scope  the list these routes keep: chats whose routes share a scope share
     *                         their conversations, and two scopes never see each other's
     */
    public static function register(string $uri, string $scope = 'default'): self
    {
        if (preg_match('/^[A-Za-z0-9._:-]{1,64}$/', $scope) !== 1) {
            throw new InvalidArgumentException("A scope of conversations is 1 to 64 letters, digits, dots, dashes, underscores or colons, not '{$scope}'.");
        }

        $one = rtrim($uri, '/').'/{conversation}';
        $routes = [Route::get($uri, [ConversationsController::class, 'index'])];
        foreach (['get' => 'show', 'put' => 'store', 'patch' => 'update', 'delete' => 'destroy'] as $verb => $action) {
            $routes[] = Route::{$verb}($one, [ConversationsController::class, $action])->where('conversation', '[A-Za-z0-9._-]{1,64}');
        }
        foreach ($routes as $route) {
            $route->defaults('scope', $scope);
        }

        return new self($routes);
    }

    /** @param  string|list<string>  $middleware */
    public function middleware(string|array $middleware): static
    {
        foreach ($this->routes as $route) {
            $route->middleware($middleware);
        }

        return $this;
    }

    /** @param  string|list<string>  $middleware */
    public function withoutMiddleware(string|array $middleware): static
    {
        foreach ($this->routes as $route) {
            $route->withoutMiddleware($middleware);
        }

        return $this;
    }
}
