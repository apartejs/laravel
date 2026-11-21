<?php

namespace Aparte\Laravel;

use Illuminate\View\ComponentAttributeBag;

/**
 * Where the attributes written on `<x-aparte::chat>` and `<x-aparte::launcher>` go.
 *
 * Everything aparté's `<aparte-chat>` takes is written on the component as on the element
 * (`placeholder`, `type-to-focus`, `attachments`, `submit-on-enter`…), so a capability of the
 * chat is never one this package forgot to name. What places the chat on the page stays on the
 * element that holds it: `class` and `style`, and Livewire's and Alpine's directives.
 *
 * tests/Feature/ParityTest.php reads `@aparte/core`'s manifest and proves both halves: every
 * attribute of the chat reaches it, and {@see LAUNCHER} is the launcher's own list.
 */
final class ChatAttributes
{
    /** `<aparte-launcher>`'s own attributes, as `@aparte/core`'s manifest lists them. */
    public const LAUNCHER = ['open', 'label', 'breakpoint', 'header', 'heading', 'subheading', 'maximizable', 'maximized', 'data-sheet'];

    /**
     * What `files` (`true`) lets a person attach: what aparté puts in the message to the model —
     * images, and text it can read. A PDF would show as attached and reach no model.
     */
    public const FILES = 'image/*,text/*,application/json,.md,.json,.csv,.tsv,.xml,.yaml,.yml,.toml,.log';

    /** Whether an attribute places the element on the page rather than configuring the chat. */
    public static function places(string $name): bool
    {
        return in_array($name, ['class', 'style'], true)
            || str_starts_with($name, 'wire:')
            || str_starts_with($name, 'x-')
            || str_starts_with($name, '@');
    }

    /** What stays on the element that holds the chat. */
    public static function holder(ComponentAttributeBag $attributes, array $own = []): ComponentAttributeBag
    {
        return $attributes->filter(fn ($value, string $name) => self::places($name) || in_array($name, $own, true));
    }

    /** What goes on `<aparte-chat>`. */
    public static function chat(ComponentAttributeBag $attributes, array $own = []): ComponentAttributeBag
    {
        return $attributes->filter(fn ($value, string $name) => ! self::places($name) && ! in_array($name, $own, true));
    }

    /** The types `files` stands for: `true` for {@see FILES}, a list as written, else none. */
    public static function files(mixed $files): ?string
    {
        // `files` alone and `:files="true"` are true; `files="true"` is the same wish, written as text.
        if ($files === true || $files === 'true') {
            return self::FILES;
        }

        return is_string($files) && ! in_array(trim($files), ['', 'false'], true) ? trim($files) : null;
    }
}
