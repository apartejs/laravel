<?php

namespace Aparte\Laravel;

use Aparte\Laravel\Http\AssetController;
use Aparte\Laravel\Http\ChatController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AparteServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'aparte');

        Route::macro('aparte', function (string $uri, string $agent) {
            return Route::post($uri, ChatController::class)->defaults('agent', $agent);
        });

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
