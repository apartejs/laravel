<?php

namespace Aparte\Laravel\Filament;

use Aparte\Laravel\ChatModels;
use Aparte\Laravel\Conversations\ConversationRoutes;
use Aparte\Laravel\Http\ChatController;
use Filament\Contracts\Plugin;
use Filament\Panel;
use Filament\View\PanelsRenderHook;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use Illuminate\View\ComponentAttributeBag;
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

    /** Whether each person's conversations are kept, and listed in the chat. */
    protected bool $conversations = false;

    /** What a person may attach for the model: off, `true` (images and text), or a list of kinds. */
    protected bool|string $files = false;

    /** Whether the person chooses the model: among config `aparte.models` (`true`), or a list of the panel's own. */
    protected bool|array $models = false;

    /** Any other attribute of the launcher or of its chat, as written on `<x-aparte::launcher>`. */
    protected array $attributes = [];

    /** @var array<'empty-state'|'above-composer'|'toolbar', Htmlable|string> The chat's slots. */
    protected array $slots = [];

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

    /**
     * Keeps each person's conversations in your database and gives the chat its list: a drawer
     * in the chat's card, a column once the chat fills the window. Publish the table first
     * (`php artisan vendor:publish --tag=aparte-migrations`, then `migrate`). Each panel keeps
     * a list of its own. Off unless called.
     */
    public function conversations(bool $conversations = true): static
    {
        $this->conversations = $conversations;

        return $this;
    }

    /**
     * A paperclip for files the model reads with the message: `true` takes images and text files,
     * a list takes the kinds it names, as for an `<input type="file">` (`'image/png,image/jpeg'`). Off unless
     * called; see the README, "Files".
     */
    public function files(bool|string $files = true): static
    {
        $this->files = $files;

        return $this;
    }

    /**
     * A choice of model under the message field: the models of config `aparte.models`, or the list given here
     * ('provider:model' => label), the only ones the panel's chat answers with. Off unless called; see the README,
     * "Choosing the model".
     *
     * @param  bool|array<string, string>  $models
     */
    public function models(bool|array $models = true): static
    {
        $this->models = $models;

        return $this;
    }

    /**
     * Any other attribute of the launcher or of its chat, as on `<x-aparte::launcher>`: the launcher keeps its own
     * (`open`, `breakpoint`, `header`, `maximized`), its chat takes the rest (`placeholder`, `type-to-focus`,
     * `stop-key`, `submit-on-enter`…). `true` writes the attribute alone, `false` or `null` none. A dedicated method
     * of this plugin, when called, wins over the same attribute here. See the README, "Filament".
     *
     * @param  array<string, string|bool|int|null>  $attributes
     */
    public function attributes(array $attributes): static
    {
        $this->attributes = $attributes;

        return $this;
    }

    /** What the chat shows before anything is said: a string is text, an Htmlable (a view, HtmlString) is markup. */
    public function emptyState(Htmlable|string|null $content): static
    {
        return $this->slot('empty-state', $content);
    }

    /** A line above the composer, as a string (text) or an Htmlable (markup). */
    public function aboveComposer(Htmlable|string|null $content): static
    {
        return $this->slot('above-composer', $content);
    }

    /** The composer's toolbar, beside send, as a string (text) or an Htmlable (markup). */
    public function toolbar(Htmlable|string|null $content): static
    {
        return $this->slot('toolbar', $content);
    }

    protected function slot(string $name, Htmlable|string|null $content): static
    {
        if ($content === null) {
            unset($this->slots[$name]);
        } else {
            $this->slots[$name] = $content;
        }

        return $this;
    }

    public function register(Panel $panel): void
    {
        if ($this->agent === null) {
            throw new LogicException('ApartePlugin needs an agent: ApartePlugin::make()->agent(MyAgent::class).');
        }

        $panel
            ->authenticatedRoutes(function () use ($panel): void {
                ChatModels::offer(Route::post('aparte-chat', ChatController::class), $this->models)
                    ->defaults('agent', $this->agent)
                    ->name('aparte-chat');

                if ($this->conversations) {
                    // A list of the panel's own: another panel, or a chat on a page of the
                    // app, answers with another agent and keeps other conversations.
                    ConversationRoutes::register('aparte-chat/conversations', 'filament:'.$panel->getId());
                }
            })
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
        $options = [
            'heading' => $this->heading,
            'subheading' => $this->subheading,
            'maximizable' => $this->maximizable === false ? null : $this->maximizable,
            'files' => $this->files === false ? null : $this->files,
        ];
        // The dedicated methods win; what they leave unset, `attributes()` may set. `label` is always the plugin's.
        $set = array_keys(array_filter($options, fn ($value) => $value !== null));
        $extra = array_diff_key($this->attributes, array_flip([...$set, 'label', 'endpoint', 'conversations', 'follow-dark-class']));
        $slots = ['empty-state' => 'emptyState', 'above-composer' => 'aboveComposer', 'toolbar' => 'toolbar'];

        $template = '<x-aparte::launcher :endpoint="$endpoint" :conversations="$conversations" :label="$label" :heading="$heading" :subheading="$subheading" :maximizable="$maximizable" :files="$files" follow-dark-class :attributes="$extra">';
        foreach ($slots as $name => $variable) {
            // `{{ }}`: a string is text, an Htmlable is markup, as in any Blade view.
            $template .= "\n@isset(\${$variable})\n<x-slot:{$name}>{{ \${$variable} }}</x-slot:{$name}>\n@endisset";
        }
        $template .= "\n</x-aparte::launcher>";

        return Blade::render($template, [
            'endpoint' => $endpoint,
            // Their routes sit under the chat's, where `register()` put them.
            'conversations' => $this->conversations ? rtrim($endpoint, '/').'/conversations' : null,
            'label' => $this->label,
            ...$options,
            'extra' => new ComponentAttributeBag($extra),
            ...array_combine(array_values($slots), array_map(fn ($name) => $this->slots[$name] ?? null, array_keys($slots))),
        ]);
    }
}
