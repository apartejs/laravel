<?php

use Illuminate\Support\Facades\Blade;

it('renders the chat, shielded from Livewire', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/chat" class="h-96" />');

    expect($html)
        ->toContain('<aparte-chat')
        ->toContain('data-aparte-endpoint="'.url('/chat').'"')
        ->toContain('wire:ignore')
        ->toContain('class="h-96"');
});

it('lets a chat have no endpoint, for an app that brings its own runner', function () {
    expect(Blade::render('<x-aparte::chat />'))
        ->toContain('<aparte-chat')
        ->toContain('data-aparte-endpoint=""');

    expect(Blade::render('<x-aparte::launcher label="Help" />'))
        ->toMatch('/<aparte-launcher[^>]*>\s*<aparte-chat/')
        ->toContain('data-aparte-endpoint=""');
});

it('passes a thread the page chose', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" thread="abc" />'))
        ->toContain('data-aparte-thread="abc"');
});

it('loads the bundle once for two chats', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/a" /><x-aparte::chat endpoint="/b" />');

    expect(substr_count($html, 'aparte-assets/js'))->toBe(1);
});

it('serves its own bundle by default', function () {
    expect(config('aparte.assets'))->toBe('bundle');
});

it('leaves the scripts and styles to the app in Vite mode', function () {
    config(['aparte.assets' => 'vite']);

    foreach (['<x-aparte::chat endpoint="/chat" />', '<x-aparte::launcher endpoint="/chat" />'] as $component) {
        expect(Blade::render($component))
            ->toContain('<aparte-chat')
            ->not->toContain('aparte-assets/');
    }
});

it('numbers the chats of a page by position', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/a" /><x-aparte::chat endpoint="/b" />');

    expect($html)->toContain('id="aparte-chat-1"')->toContain('id="aparte-chat-2"');
});

it('leaves the composition to the chat when no slot is used', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" />'))->not->toContain('<aparte-composer');
});

it('places the three slots', function () {
    $html = Blade::render(<<<'BLADE'
        <x-aparte::chat endpoint="/chat">
            <x-slot:empty-state>WELCOME</x-slot:empty-state>
            <x-slot:above-composer>ABOVE</x-slot:above-composer>
            <x-slot:toolbar>TOOLS</x-slot:toolbar>
        </x-aparte::chat>
        BLADE);

    expect($html)
        ->toMatch('/data-aparte-empty-state>WELCOME/')
        ->toMatch('/ABOVE\s*<aparte-composer/')
        ->toMatch('/<aparte-composer-toolbar>TOOLS/')
        ->toContain('<aparte-elicitation');
});

it('makes the chat a direct child of the launcher, which sizes it', function () {
    $html = Blade::render('<x-aparte::launcher endpoint="/chat" label="Help" />');

    expect($html)
        ->toContain('label="Help"')
        ->toMatch('/<aparte-launcher[^>]*>\s*<aparte-chat/')
        ->not->toMatch('/<aparte-launcher[^>]*>\s*<(script|link)/');
});

it('hands the header and maximize attributes to the launcher', function () {
    $html = Blade::render('<x-aparte::launcher endpoint="/chat" label="Help" heading="Support" subheading="Replies in a minute" maximizable="panel" />');

    expect($html)
        ->toContain('heading="Support"')
        ->toContain('subheading="Replies in a minute"')
        ->toContain('maximizable="panel"');
});
