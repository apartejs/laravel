<?php

use Aparte\Laravel\ChatModels;
use Aparte\Laravel\Filament\ApartePlugin;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Filament\Panel;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use Laravel\Ai\Prompts\AgentPrompt;

/*
 * The person chooses the model in the chat, among the ones its route offers (`Route::aparte(…, models: …)`): the
 * chat draws the list, sends the choice with the message (AG-UI's forwardedProps.model), and the route answers with
 * it when its list has it. The browser is anyone's to change, so a name outside that list chooses nothing, and a
 * route that offers no choice (TestCase's `/chat`) takes none.
 */

beforeEach(function () {
    config(['aparte.models' => [
        'openai:gpt-test' => 'GPT test',
        'anthropic:claude-test' => 'Claude <test> & co',
    ]]);
    Route::aparte('/choosing', TestAgent::class, models: true);
    Route::aparte('/own', TestAgent::class, models: ['anthropic:claude-own' => 'Claude own']);
});

/** A message sent with a model chosen, as the chat sends it. */
function choosing(mixed $model, array $input = []): array
{
    return [
        'threadId' => 'thread-1',
        'runId' => 'run-1',
        'messages' => [['id' => 'm1', 'role' => 'user', 'content' => 'Hello']],
        ...$input,
        'forwardedProps' => ['model' => $model],
    ];
}

/** The agent, faked: each answer records the provider and the model it came from, as "provider:model". */
function answering(): ArrayObject
{
    $used = new ArrayObject;
    TestAgent::fake(function ($prompt, $attachments, $provider, string $model) use ($used) {
        $used[] = $provider->name().':'.$model;

        return 'Hi';
    });

    return $used;
}

it('answers with the model the person chose', function () {
    $used = answering();

    $this->postJson('/choosing', choosing('anthropic:claude-test'))->assertOk()->streamedContent();

    expect($used->getArrayCopy())->toBe(['anthropic:claude-test']);
});

it('answers with the agent\'s own model when the choice is not in the route\'s list', function (string $route, mixed $model) {
    $used = answering();
    // First what the agent answers with when nothing is chosen, then with the choice.
    $this->postJson($route, choosing(null))->assertOk()->streamedContent();
    $this->postJson($route, choosing($model, ['threadId' => 'thread-2']))->assertOk()->streamedContent();

    [$own, $then] = $used->getArrayCopy();
    expect($then)->toBe($own)
        ->and($own)->not->toBe(is_string($model) ? $model : '');
})->with([
    'a model the app does not list' => ['/choosing', 'openai:gpt-evil'],
    'not a name' => ['/choosing', ['anthropic:claude-test']],
    'nothing' => ['/choosing', null],
    // A route that offers no choice, a public chat say, takes none: not even a model another route offers.
    'a route that offers no choice' => ['/chat', 'anthropic:claude-test'],
    'a model of the config, on a route with a list of its own' => ['/own', 'anthropic:claude-test'],
]);

it('answers with a model of a route\'s own list', function () {
    $used = answering();

    $this->postJson('/own', choosing('anthropic:claude-own'))->assertOk()->streamedContent();

    expect($used->getArrayCopy())->toBe(['anthropic:claude-own']);
});

it('answers an approval with the model the person chose', function () {
    $used = answering();
    $approved = ['messages' => [], 'resume' => [['interruptId' => 'call-1', 'status' => 'resolved', 'payload' => ['approved' => true]]]];

    $this->postJson('/choosing', choosing('anthropic:claude-test', $approved))->assertOk()->streamedContent();

    expect($used->getArrayCopy())->toBe(['anthropic:claude-test']);
});

it('lists only what reads as a model', function () {
    config(['aparte.models' => ['openai:gpt-test' => 'GPT test', 'no-provider' => 'Broken', 'openai:gpt-two' => ['not', 'a label']]]);

    expect(ChatModels::at('/choosing'))->toBe(['openai:gpt-test' => 'GPT test']);
});

it('knows what the route at an address offers, and nothing at an address it does not serve', function () {
    expect(ChatModels::at('/choosing'))->toHaveCount(2)
        ->and(ChatModels::at('/own'))->toBe(['anthropic:claude-own' => 'Claude own'])
        ->and(ChatModels::at('/chat'))->toBe([])
        ->and(ChatModels::at('/nowhere'))->toBe([])
        ->and(ChatModels::at(null))->toBe([]);
});

it('draws the route\'s list in the composer, the first chosen, the labels as text', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/choosing" />');

    expect($html)->toMatch('#<aparte-composer-toolbar>\s*<aparte-select data-aparte-model aria-label="Model" value="openai:gpt-test">#')
        ->and($html)->toContain('<aparte-option value="openai:gpt-test">GPT test</aparte-option>')
        ->and($html)->toContain('<aparte-option value="anthropic:claude-test">Claude &lt;test&gt; &amp; co</aparte-option>')
        ->and(strpos($html, 'openai:gpt-test">GPT'))->toBeLessThan(strpos($html, 'anthropic:claude-test">Claude'));
});

it('says "Model" in the page\'s language', function () {
    app()->setLocale('fr');

    expect(Blade::render('<x-aparte::chat endpoint="/choosing" />'))->toContain('aria-label="Modèle"');
});

it('draws no list for a route that offers none, nor when the app lists no model', function () {
    $plain = Blade::render('<x-aparte::chat endpoint="/chat" />');
    expect($plain)->not->toContain('data-aparte-model')
        // The composer stays aparté's own: the package writes one only for a slot or a list.
        ->and($plain)->not->toContain('<aparte-composer');

    config(['aparte.models' => []]);

    expect(Blade::render('<x-aparte::chat endpoint="/choosing" />'))->not->toContain('data-aparte-model');
});

it('draws the list beside the toolbar the view writes', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/choosing"><x-slot:toolbar><button>Mine</button></x-slot:toolbar></x-aparte::chat>');

    expect(substr_count($html, '<aparte-composer-toolbar>'))->toBe(1)
        ->and(strpos($html, 'data-aparte-model'))->toBeLessThan(strpos($html, '<button>Mine</button>'));
});

it('draws the list in the launcher\'s chat, with its conversations or without', function (string $view) {
    expect(Blade::render($view))->toContain('<aparte-select data-aparte-model');
})->with([
    'alone' => ['<x-aparte::launcher endpoint="/choosing" />'],
    'with its list' => ['<x-aparte::launcher endpoint="/choosing" list />'],
]);

/** A panel's assistant, its routes registered as Filament does for someone signed in. */
function panelAssistant(ApartePlugin $plugin): ApartePlugin
{
    $panel = Panel::make()->id('admin')->path('admin');
    $plugin->agent(TestAgent::class)->register($panel);
    app('router')->prefix('admin')->group(function () use ($panel) {
        foreach ($panel->getAuthenticatedRoutes() as $routes) {
            $routes($panel);
        }
    });

    return $plugin;
}

it('gives the Filament assistant the list of models, and its route takes them', function () {
    $plugin = panelAssistant(ApartePlugin::make()->models());

    expect($plugin->launcherFor(url('/admin/aparte-chat')))->toContain('<aparte-select data-aparte-model')
        ->and(ChatModels::at('/admin/aparte-chat'))->toHaveCount(2);
});

it('gives the Filament assistant a list of its own', function () {
    panelAssistant(ApartePlugin::make()->models(['anthropic:claude-panel' => 'Claude panel']));

    expect(ChatModels::at('/admin/aparte-chat'))->toBe(['anthropic:claude-panel' => 'Claude panel']);
});

it('gives the Filament assistant no list unless asked', function () {
    $plugin = panelAssistant(ApartePlugin::make());

    expect($plugin->launcherFor(url('/admin/aparte-chat')))->not->toContain('data-aparte-model')
        ->and(ChatModels::at('/admin/aparte-chat'))->toBe([]);
});
