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
