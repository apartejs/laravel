<?php

namespace Aparte\Laravel\Conversations;

use Aparte\Laravel\Http\PeopleController;
use Aparte\Laravel\People;
use Illuminate\Routing\Route as RegisteredRoute;
use Illuminate\Support\Facades\Route;

/**
 * The two routes `Route::apartePeople()` registers for a chat whose conversations someone of
 * your team can take over: `GET $uri/{id}` (who holds it) and `POST $uri/{id}/messages` (what
 * the person writes meanwhile). What it gives back takes the app's middleware, for both:
 * `Route::apartePeople('/chat/people')->middleware('web')`.
 */
class PeopleRoutes
{
    /** @param  list<RegisteredRoute>  $routes */
    private function __construct(private array $routes) {}

    public static function register(string $uri): self
    {
        $one = rtrim($uri, '/').'/{conversation}';
        People::filesUnder($uri);

        return new self([
            Route::get($one, [PeopleController::class, 'show'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
            Route::post($one.'/messages', [PeopleController::class, 'store'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
            Route::post($one.'/want', [PeopleController::class, 'want'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
            Route::post($one.'/typing', [PeopleController::class, 'typing'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
            Route::post($one.'/seen', [PeopleController::class, 'seen'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
            Route::post($one.'/email', [PeopleController::class, 'email'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
            Route::get($one.'/files/{file}', [PeopleController::class, 'file'])->where('conversation', '[A-Za-z0-9._-]{1,64}'),
        ]);
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
