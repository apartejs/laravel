<?php

use Aparte\Laravel\ChatAttributes;
use Illuminate\Support\Facades\Blade;

/*
 * What the framework wrappers get by construction, the Blade components must too: every attribute aparté's
 * `<aparte-chat>` takes reaches it from `<x-aparte::chat>` and from `<x-aparte::launcher>`, and the launcher keeps
 * exactly its own. The source is `@aparte/core`'s manifest, as the npm package ships it: when the chat this package
 * builds follows a new aparté (follow-aparte.yml), an attribute it adds is checked here with no list to update.
 */

/** `<aparte-chat>` and `<aparte-launcher>` as `@aparte/core`'s manifest declares them. */
function manifest(string $tag): array
{
    $path = dirname(__DIR__, 2).'/node_modules/@aparte/core/dist/custom-elements.json';
    if (! is_file($path)) {
        throw new RuntimeException("No {$path}: run `npm ci` at the package's root. This test reads aparté's own list of attributes, and passing without it would prove nothing.");
    }
    foreach (json_decode(file_get_contents($path), true)['modules'] as $module) {
        foreach ($module['declarations'] ?? [] as $declaration) {
            if (($declaration['tagName'] ?? null) === $tag) {
                return array_column($declaration['attributes'] ?? [], 'name');
            }
        }
    }
    throw new RuntimeException("The manifest has no <{$tag}>.");
}

it('reads a manifest that still lists the attributes it is meant to', function () {
    // A list that silently shrinks would make the two tests below pass on nothing.
    expect(manifest('aparte-chat'))->toContain('placeholder', 'attachments', 'type-to-focus')
        ->and(manifest('aparte-launcher'))->toContain('label', 'heading', 'open');
});

it("hands every attribute of aparté's chat to the chat, from both components", function () {
    foreach (manifest('aparte-chat') as $attribute) {
        foreach (['chat', 'launcher'] as $component) {
            $html = Blade::render("<x-aparte::{$component} endpoint=\"/chat\" {$attribute}=\"probe\" />");

            expect(preg_match('/<aparte-chat\b[^>]*>/s', $html, $tag))->toBe(1);
            expect(str_contains($tag[0], "{$attribute}=\"probe\""))->toBeTrue("<x-aparte::{$component} {$attribute}> does not reach <aparte-chat>");
        }
    }
});

it("keeps on the launcher exactly the launcher's own attributes", function () {
    // `label` is a prop of the component, with a default; the rest pass as written.
    expect(ChatAttributes::LAUNCHER)->toEqualCanonicalizing(manifest('aparte-launcher'));

    foreach (array_diff(manifest('aparte-launcher'), ['label']) as $attribute) {
        $html = Blade::render("<x-aparte::launcher endpoint=\"/chat\" {$attribute}=\"probe\" />");

        expect(preg_match('/<aparte-launcher\b[^>]*>/s', $html, $tag))->toBe(1);
        expect(str_contains($tag[0], "{$attribute}=\"probe\""))->toBeTrue("<x-aparte::launcher {$attribute}> does not reach <aparte-launcher>");
    }
});
