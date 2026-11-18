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

    /**
     * A conversation's id, as the chat route takes it: 36 characters at most (the SDK's column),
     * and never only dots.
     */
    public const ID = '(?![.]+(?:/|$))[A-Za-z0-9._-]{1,36}';

    public static function register(string $uri): self
    {
        $one = rtrim($uri, '/').'/{conversation}';

        // Every POST is throttled by default (`aparte.people.throttle`): these routes answer guests.
        $file = Route::get($one.'/files/{file}', [PeopleController::class, 'file'])->where('conversation', self::ID);
        // Named once, for People::attach() to build a file's address, a route cache included.
        if (! Route::has(People::FILE_ROUTE)) {
            $file->name(People::FILE_ROUTE);
        }

        return new self([
            Route::get($one, [PeopleController::class, 'show'])->where('conversation', self::ID),
            Route::post($one.'/messages', [PeopleController::class, 'store'])->where('conversation', self::ID)->middleware('throttle:aparte-people'),
            Route::post($one.'/want', [PeopleController::class, 'want'])->where('conversation', self::ID)->middleware('throttle:aparte-people'),
            Route::post($one.'/typing', [PeopleController::class, 'typing'])->where('conversation', self::ID)->middleware('throttle:aparte-people-presence'),
            Route::post($one.'/seen', [PeopleController::class, 'seen'])->where('conversation', self::ID)->middleware('throttle:aparte-people-presence'),
            Route::post($one.'/email', [PeopleController::class, 'email'])->where('conversation', self::ID)->middleware('throttle:aparte-people'),
            Route::post($one.'/rating', [PeopleController::class, 'rating'])->where('conversation', self::ID)->middleware('throttle:aparte-people'),
            $file,
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
