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

    protected ?string $heading = null;

    protected ?string $subheading = null;

    /** Off, on (the chat fills the window), or `'panel'` (a panel along the edge, the page in view). */
    protected bool|string $maximizable = false;

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

    /** The title of the chat's header. Without it, the header shows the button's label. */
    public function heading(string $heading): static
    {
        $this->heading = $heading;

        return $this;
    }

    /** A line under the header's title: who answers, how fast. */
    public function subheading(string $subheading): static
    {
        $this->subheading = $subheading;

        return $this;
    }

    /**
     * A button in the chat's header that maximizes it: `true` fills the window, `'panel'` keeps
     * the panel's page in view beside a full-height chat. Off unless called.
     */
    public function maximizable(bool|string $maximizable = true): static
    {
        if (is_string($maximizable) && $maximizable !== 'panel') {
            throw new LogicException("ApartePlugin::maximizable() takes true, false or 'panel', not '{$maximizable}'.");
        }
        $this->maximizable = $maximizable;

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

        return $this->launcherFor(route("filament.{$panel->getId()}.aparte-chat"));
    }

    /**
     * The launcher's markup for an endpoint, with the header and maximize options. A `null` or
     * `false` option writes no attribute, so the element's own default stands.
     *
     * @internal Public so the options can be tested without a signed-in panel.
     */
    public function launcherFor(string $endpoint): string
    {
        return Blade::render(
            '<x-aparte::launcher :endpoint="$endpoint" :label="$label" :heading="$heading" :subheading="$subheading" :maximizable="$maximizable" follow-dark-class />',
            [
                'endpoint' => $endpoint,
                'label' => $this->label,
                'heading' => $this->heading,
                'subheading' => $this->subheading,
                'maximizable' => $this->maximizable,
            ],
        );
    }
}
