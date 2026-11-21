<?php

namespace Aparte\Laravel;

use Illuminate\View\ComponentAttributeBag;

/**
 * Where the attributes written on `<x-aparte::chat>` and `<x-aparte::launcher>` go.
 *
 * Everything aparté's `<aparte-chat>` takes is written on the component as on the element
 * (`placeholder`, `type-to-focus`, `attachments`, `submit-on-enter`…), so a capability of the
 * chat is never one this package forgot to name. What places or names the element on the page
 * stays on the one that holds the chat, as it always did: `class`, `style`, `id`, `title`,
 * `role`, `hidden`, `data-*` and `aria-*`, and Livewire's and Alpine's directives.
 *
 * tests/Feature/ParityTest.php reads `@aparte/core`'s manifest and proves both halves: every
 * attribute of the chat reaches it, and {@see LAUNCHER} is the launcher's own list.
 */
final class ChatAttributes
{
    /** `<aparte-launcher>`'s own attributes, as `@aparte/core`'s manifest lists them. */
    public const LAUNCHER = ['open', 'label', 'breakpoint', 'header', 'heading', 'subheading', 'maximizable', 'maximized', 'data-sheet'];

    /**
     * What `files` (`true`) lets a person attach: what aparté puts in the message to the model, and the model
     * reads. Images in the four formats the model APIs take (an SVG or a HEIC would fail the whole turn), and
     * text: the types aparté inlines, and the extensions it inlines by name (aparte-client's own list), less
     * `.env` (secrets) and `.svg` (an image to a browser, refused as one by the model). A PDF would show as
     * attached and reach no model.
     */
    public const FILES = 'image/png,image/jpeg,image/gif,image/webp,text/*,application/json,application/xml,'
        .'.txt,.md,.markdown,.json,.jsonl,.csv,.tsv,.xml,.html,.htm,.css,.js,.mjs,.cjs,.ts,.tsx,.jsx,.py,.rb,'
        .'.java,.c,.cpp,.h,.go,.rs,.php,.sh,.bash,.zsh,.fish,.yaml,.yml,.toml,.ini,.log,.graphql,.gql';

    /** Whether an attribute places or names the element on the page rather than configuring the chat. */
    public static function places(string $name): bool
    {
        return in_array($name, ['class', 'style', 'id', 'title', 'role', 'tabindex', 'hidden', 'lang', 'dir'], true)
            || str_starts_with($name, 'data-')
            || str_starts_with($name, 'aria-')
            || str_starts_with($name, 'wire:')
            || str_starts_with($name, 'x-')
            // Alpine's shorthands: `@click`, and `::class` written on a component, which arrives as `:class`.
            || str_starts_with($name, '@')
            || str_starts_with($name, ':');
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

    /** Whether a bag turns a boolean attribute on: written, and not bound to `false` or `null`. */
    public static function on(ComponentAttributeBag $attributes, string $name): bool
    {
        return $attributes->has($name) && ! in_array($attributes->get($name), [false, null], true);
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
