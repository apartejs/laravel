<?php

namespace Aparte\Laravel;

use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * The models a person may choose in a chat. A chat route takes a choice only when it says so
 * (`Route::aparte($uri, $agent, models: true)`, `->models()` in Filament), and its list is the config's
 * (`aparte.models`) or its own. Its chats draw that list. The browser names its choice (AG-UI's
 * `forwardedProps.model`), and the route answers with it only when its own list has it: a page anyone can
 * change chooses nothing its route did not offer, and a route that offers no choice (a public chat, say)
 * takes none, not even a model another route offers.
 */
final class ChatModels
{
    /** The key of a chat route's action that holds what it offers: kept by `route:cache` with the rest. */
    private const ACTION = 'aparte_models';

    /**
     * A chat route takes a choice: `true` offers config `aparte.models`, an array its own list.
     *
     * @param  bool|array<string, string>  $models
     */
    public static function offer(Route $route, bool|array $models): Route
    {
        return $models === false || $models === []
            ? $route
            : $route->setAction(array_merge($route->getAction(), [self::ACTION => $models]));
    }

    /** @return array<string, string> what a chat route offers, 'provider:model' => label, in its order */
    public static function of(?Route $route): array
    {
        $models = $route?->getAction(self::ACTION);
        if ($models === true) {
            $models = config('aparte.models', []);
        }

        return is_array($models)
            ? array_filter($models, fn ($label, $id) => is_string($id) && str_contains($id, ':') && is_string($label), ARRAY_FILTER_USE_BOTH)
            : [];
    }

    /** @return array<string, string> what the chat route at this address offers: the list its chat draws */
    public static function at(?string $endpoint): array
    {
        if (! is_string($endpoint) || $endpoint === '') {
            return [];
        }

        try {
            return self::of(app('router')->getRoutes()->match(Request::create(url($endpoint), 'POST')));
        } catch (HttpExceptionInterface) {
            // No route of this app's answers there: nothing it offers.
            return [];
        }
    }

    /**
     * The provider and the model a request chose, when its route offers that model.
     *
     * @return array{0: string, 1: string}|null
     */
    public static function chosen(?Route $route, mixed $id): ?array
    {
        if (! is_string($id) || ! array_key_exists($id, self::of($route))) {
            return null;
        }
        [$provider, $model] = explode(':', $id, 2);

        return [$provider, $model];
    }
}
