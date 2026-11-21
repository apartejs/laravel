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

it('passes a thread the page chose, for someone signed in', function () {
    $this->actingAs((new \Illuminate\Foundation\Auth\User)->forceFill(['id' => 1]));

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

it('gives a chat the id its view names, on the chat itself', function () {
    // What `for="support"` on a list or a button looks for is the chat, not the block around it.
    $html = Blade::render('<x-aparte::chat endpoint="/a" id="support" /><x-aparte::chat endpoint="/b" />');

    expect($html)
        ->toMatch('/<aparte-chat\s+id="support"/')
        ->not->toMatch('/<div[^>]*id="support"/')
        // The others keep the number of their place on the page.
        ->toContain('id="aparte-chat-2"');
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

it('names the people routes, for a chat someone of the team can take over', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" />'))
        ->toContain('data-aparte-people="'.url('/chat/people').'"');
    expect(Blade::render('<x-aparte::launcher endpoint="/chat" people="/chat/people" />'))
        ->toContain('data-aparte-people="'.url('/chat/people').'"');
    expect(Blade::render('<x-aparte::chat endpoint="/chat" />'))->not->toContain('data-aparte-people');
});

it('gives a chat with people a button to ask for someone only when the app turns it on', function () {
    // Off by default: without something hearing SomeoneWanted, a visitor would wait for nobody.
    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" />'))->not->toContain('data-aparte-people-button')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-button="true" />'))->toContain('data-aparte-people-button="Talk to a person"')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" people-button="Parler à quelqu\'un" />'))->toContain('data-aparte-people-button="Parler à quelqu&#039;un"')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-button="false" />'))->not->toContain('data-aparte-people-button')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people-button="Talk to a person" />'))->not->toContain('data-aparte-people-button');
});

/** The opening tag of the first `$tag` in `$html`, attributes and all. */
function startTag(string $html, string $tag): string
{
    return preg_match('/<'.preg_quote($tag, '/').'\b[^>]*>/s', $html, $match) ? $match[0] : '';
}

it("hands the chat its own attributes, and keeps the chat's place on the page around it", function () {
    $html = Blade::render('<x-aparte::chat endpoint="/chat" class="h-96" style="height: 32rem" wire:key="help" x-data="{}" ::class="{ hidden: !open }" data-testid="help" aria-label="Help" title="Help" placeholder="Ask about your order" type-to-focus="page" stop-key="Escape" submit-on-enter="false" />');

    expect(startTag($html, 'aparte-chat'))
        ->toContain('placeholder="Ask about your order"')
        ->toContain('type-to-focus="page"')
        ->toContain('stop-key="Escape"')
        ->toContain('submit-on-enter="false"')
        ->not->toContain('class=')
        ->not->toContain('wire:key')
        ->not->toContain('data-testid')
        ->not->toContain('aria-label')
        ->not->toContain('title=');
    // What places or names the element stays where it always was, Alpine's `::class` included (it arrives as `:class`).
    expect(startTag($html, 'div'))
        ->toContain('class="h-96"')
        ->toContain('style="height: 32rem"')
        ->toContain('wire:key="help"')
        ->toContain('x-data="{}"')
        ->toContain(':class="{ hidden: !open }"')
        ->toContain('data-testid="help"')
        ->toContain('aria-label="Help"')
        ->toContain('title="Help"')
        ->not->toContain('placeholder');
});

it("keeps the launcher's own attributes on it, and hands it the chat's", function () {
    $html = Blade::render('<x-aparte::launcher endpoint="/chat" label="Help" heading="Support" breakpoint="600" class="corner" data-testid="corner" placeholder="Ask us anything" stop-key="Escape" />');

    expect(startTag($html, 'aparte-launcher'))
        ->toContain('heading="Support"')
        ->toContain('breakpoint="600"')
        ->toContain('class="corner"')
        ->toContain('data-testid="corner"')
        ->not->toContain('placeholder')
        ->not->toContain('stop-key');
    expect(startTag($html, 'aparte-chat'))
        ->toContain('placeholder="Ask us anything"')
        ->toContain('stop-key="Escape"')
        ->not->toContain('heading');
});

it('gives the chat a paperclip for the model with files, whoever answers', function () {
    expect(startTag(Blade::render('<x-aparte::chat endpoint="/chat" files />'), 'aparte-chat'))
        ->toMatch('/\sattachments\s/')
        ->toContain('data-aparte-files="'.\Aparte\Laravel\ChatAttributes::FILES.'"');
    expect(startTag(Blade::render('<x-aparte::chat endpoint="/chat" files="image/png,image/jpeg" />'), 'aparte-chat'))
        ->toContain('data-aparte-files="image/png,image/jpeg"');
    // The default takes only the picture formats the model APIs read: an SVG or a HEIC would fail the turn.
    expect(\Aparte\Laravel\ChatAttributes::FILES)->not->toContain('image/*')->not->toContain('.svg')->not->toContain('.env');
    expect(startTag(Blade::render('<x-aparte::launcher endpoint="/chat" files />'), 'aparte-chat'))
        ->toContain('data-aparte-files=');

    foreach (['<x-aparte::chat endpoint="/chat" />', '<x-aparte::chat endpoint="/chat" :files="false" />', '<x-aparte::chat endpoint="/chat" files="false" />'] as $none) {
        expect(startTag(Blade::render($none), 'aparte-chat'))->not->toContain('attachments')->not->toContain('data-aparte-files');
    }
});

it('keeps the paperclip, the placeholder and disabled in a chat with slots', function () {
    $html = Blade::render(<<<'BLADE'
        <x-aparte::chat endpoint="/chat" files placeholder="Ask" disabled>
            <x-slot:toolbar>TOOLS</x-slot:toolbar>
        </x-aparte::chat>
        BLADE);

    expect($html)
        ->toContain('<aparte-composer-add-attachment>')
        ->toContain('<aparte-composer-attachments>')
        ->toContain('data-aparte-laravel-shell');
    expect(startTag($html, 'aparte-composer'))->toContain('placeholder="Ask"')->toContain('disabled');

    // Without files, the paperclip of a chat with slots is left to the team's code, which adds it when it is offered.
    expect(Blade::render('<x-aparte::chat endpoint="/chat"><x-slot:toolbar>TOOLS</x-slot:toolbar></x-aparte::chat>'))
        ->not->toContain('<aparte-composer-add-attachment');
    // Nor when the view bound it off: aparté would not take it out of a composer it did not write.
    $off = Blade::render('<x-aparte::chat endpoint="/chat" :attachments="false" :disabled="false"><x-slot:toolbar>TOOLS</x-slot:toolbar></x-aparte::chat>');
    expect($off)->not->toContain('<aparte-composer-add-attachment');
    expect(startTag($off, 'aparte-composer'))->not->toContain('disabled');
});
