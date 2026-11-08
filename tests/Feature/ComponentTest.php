<?php

use Illuminate\Support\Facades\Blade;

it('renders the chat, shielded from Livewire', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/chat" class="h-96" />');

    expect($html)
        ->toContain('<aparte-chat')
        ->toContain('data-aparte-endpoint="http://localhost/chat"')
        ->toContain('wire:ignore')
        ->toContain('class="h-96"');
});

it('passes a thread the page chose', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" thread="abc" />'))
        ->toContain('data-aparte-thread="abc"');
});

it('loads the bundle once for two chats', function () {
    $html = Blade::render('<x-aparte::chat endpoint="/a" /><x-aparte::chat endpoint="/b" />');

    expect(substr_count($html, 'aparte-assets/aparte.js'))->toBe(1);
});
