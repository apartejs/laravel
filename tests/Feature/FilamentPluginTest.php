<?php

use Aparte\Laravel\Filament\ApartePlugin;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Filament\Panel;

it('asks for an agent', function () {
    ApartePlugin::make()->register(Panel::make()->id('admin')->path('admin'));
})->throws(LogicException::class, 'ApartePlugin needs an agent');

it('registers under its own id', function () {
    expect(ApartePlugin::make()->agent(TestAgent::class)->getId())->toBe('aparte');
});

it('adds its route to the panel, behind authentication', function () {
    $panel = Panel::make()->id('admin')->path('admin');

    ApartePlugin::make()->agent(TestAgent::class)->register($panel);

    expect($panel->getAuthenticatedRoutes())->toHaveCount(1);
});

it('draws the launcher with its label, and no header option it was not given', function () {
    $html = ApartePlugin::make()->agent(TestAgent::class)->launcherFor('/admin/aparte-chat');

    expect($html)
        ->toContain('label="Assistant"')
        ->not->toContain('heading=')
        ->not->toContain('maximizable');
});

it('passes the header and maximize options to the launcher', function () {
    $html = ApartePlugin::make()->agent(TestAgent::class)
        ->heading('Support')
        ->subheading('Replies in a minute')
        ->maximizable('panel')
        ->launcherFor('/admin/aparte-chat');

    expect($html)
        ->toContain('heading="Support"')
        ->toContain('subheading="Replies in a minute"')
        ->toContain('maximizable="panel"');
});

it('maximizes to the whole window when no mode is given', function () {
    $html = ApartePlugin::make()->agent(TestAgent::class)->maximizable()->launcherFor('/admin/aparte-chat');

    expect($html)
        ->toMatch('/<aparte-launcher[^>]*\\smaximizable(="maximizable")?[\\s>]/')
        ->not->toContain('maximizable="panel"');
});

it('refuses a maximize mode it does not know', function () {
    ApartePlugin::make()->maximizable('full');
})->throws(LogicException::class, "takes true, false or 'panel'");

/** The routes a panel's plugin registers for someone signed in, as "VERB uri". */
function panelRoutes(ApartePlugin $plugin): array
{
    $panel = Panel::make()->id('admin')->path('admin');
    $plugin->register($panel);

    $router = app('router');
    $before = count($router->getRoutes()->getRoutes());
    $router->prefix('admin')->group(function () use ($panel) {
        foreach ($panel->getAuthenticatedRoutes() as $routes) {
            $routes($panel);
        }
    });

    return array_map(
        fn ($route) => $route->methods()[0].' '.$route->uri(),
        array_slice($router->getRoutes()->getRoutes(), $before),
    );
}

it('keeps conversations only when asked', function () {
    expect(panelRoutes(ApartePlugin::make()->agent(TestAgent::class)))->toBe(['POST admin/aparte-chat']);
});

it('adds the routes that keep conversations, beside the chat', function () {
    expect(panelRoutes(ApartePlugin::make()->agent(TestAgent::class)->conversations()))->toBe([
        'POST admin/aparte-chat',
        'GET admin/aparte-chat/conversations',
        'GET admin/aparte-chat/conversations/{conversation}',
        'PUT admin/aparte-chat/conversations/{conversation}',
        'PATCH admin/aparte-chat/conversations/{conversation}',
        'DELETE admin/aparte-chat/conversations/{conversation}',
    ]);
});

it('adds them whatever the order providers boot in', function () {
    // A panel registers its routes while Filament boots: nothing says this package booted first.
    Illuminate\Routing\Router::flushMacros();

    try {
        expect(panelRoutes(ApartePlugin::make()->agent(TestAgent::class)->conversations()))->toHaveCount(6);
    } finally {
        (new Aparte\Laravel\AparteServiceProvider(app()))->register();
    }
});

it('keeps a list of its own for each panel', function () {
    $panel = Panel::make()->id('staff')->path('staff');
    ApartePlugin::make()->agent(TestAgent::class)->conversations()->register($panel);
    $before = count(app('router')->getRoutes()->getRoutes());
    foreach ($panel->getAuthenticatedRoutes() as $routes) {
        $routes($panel);
    }

    $kept = array_slice(app('router')->getRoutes()->getRoutes(), $before + 1);

    expect($kept)->toHaveCount(5);
    foreach ($kept as $route) {
        expect($route->defaults['scope'])->toBe('filament:staff');
    }
});

it('gives the chat its list when conversations are kept', function () {
    $this->actingAs((new Illuminate\Foundation\Auth\User)->forceFill(['id' => 1]));

    $html = ApartePlugin::make()->agent(TestAgent::class)->conversations()->launcherFor('/admin/aparte-chat');

    expect($html)
        ->toContain('data-aparte-conversations="'.url('/admin/aparte-chat/conversations').'"')
        ->toContain('<aparte-conversation-list');
});

it('draws no list when conversations are not kept', function () {
    $this->actingAs((new Illuminate\Foundation\Auth\User)->forceFill(['id' => 1]));

    expect(ApartePlugin::make()->agent(TestAgent::class)->launcherFor('/admin/aparte-chat'))
        ->not->toContain('data-aparte-conversations')
        ->not->toContain('<aparte-conversation-list');
});
