<?php

namespace Aparte\Laravel\Filament;

use Aparte\Laravel\Http\ChatController;
use Filament\Contracts\Plugin;
use Filament\Panel;
use Filament\View\PanelsRenderHook;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use LogicException;

/**
 * A chat in the corner of every page of a panel, for whoever is signed in to it:
 * `->plugin(ApartePlugin::make()->agent(Assistant::class))`.
 */
class ApartePlugin implements Plugin
{
    protected ?string $agent = null;

    protected string $label = 'Assistant';

    public static function make(): static
    {
        return app(static::class);
    }

    public function getId(): string
    {
        return 'aparte';
    }

    public function agent(string $agent): static
    {
        $this->agent = $agent;

        return $this;
    }

    public function label(string $label): static
    {
        $this->label = $label;

        return $this;
    }

    public function register(Panel $panel): void
    {
        if ($this->agent === null) {
            throw new LogicException('ApartePlugin needs an agent: ApartePlugin::make()->agent(MyAgent::class).');
        }

        $panel
            ->authenticatedRoutes(fn () => Route::post('aparte-chat', ChatController::class)
                ->defaults('agent', $this->agent)
                ->name('aparte-chat'))
            ->renderHook(PanelsRenderHook::BODY_END, fn (): string => $this->launcher($panel));
    }

    public function boot(Panel $panel): void {}

    /** Nothing on the login page: there is nobody to answer yet. */
    protected function launcher(Panel $panel): string
    {
        if (! $panel->auth()->check()) {
            return '';
        }

        return Blade::render(
            '<x-aparte::launcher :endpoint="$endpoint" :label="$label" follow-dark-class />',
            ['endpoint' => route("filament.{$panel->getId()}.aparte-chat"), 'label' => $this->label],
        );
    }
}
