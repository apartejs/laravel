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
