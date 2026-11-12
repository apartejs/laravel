@props(['endpoint' => null, 'thread' => null, 'label' => 'Chat', 'followDarkClass' => false, 'conversations' => null])

@include('aparte::partials.assets')

@php
    // A list needs conversations that are kept, and someone to keep them for.
    $history = $conversations && auth()->check();
    $control = 'aparte-btn aparte-btn--icon aparte-btn--ghost';
@endphp

{{-- The button that floats in a corner of the page and opens the chat above it. --}}
<aparte-launcher label="{{ $label }}" wire:ignore {{ $attributes }}>
    @if ($history)
        {{-- With its conversations kept, the chat is a card of its own: the list in a drawer (a column once the
             chat fills the window), and a header that names the conversation and starts a new one. --}}
        <div class="aparte-app-shell">
            {{-- A drawer whatever the window's width: the card is narrow. The package's script lets it be a
                 column while the chat fills the window. --}}
            <aparte-sidebar breakpoint="100000rem">
                <div class="aparte-sidebar__header">
                    <span class="aparte-sidebar__brand">{{ __('Conversations') }}</span>
                    <button type="button" class="{{ $control }}" aria-label="{{ __('New chat') }}" title="{{ __('New chat') }}" data-aparte-new-chat><aparte-icon name="edit"></aparte-icon></button>
                </div>
                <div class="aparte-sidebar__search">
                    <input type="search" class="aparte-field aparte-field--sm" placeholder="{{ __('Search chats') }}" aria-label="{{ __('Search chats') }}" data-aparte-sidebar-search>
                </div>
                <div class="aparte-sidebar__body">
                    <aparte-conversation-list manage></aparte-conversation-list>
                </div>
            </aparte-sidebar>
            <header class="aparte-app-header">
                <button type="button" class="{{ $control }} aparte-app-header__toggle" aria-label="{{ __('Conversations') }}" title="{{ __('Conversations') }}" data-aparte-sidebar-toggle><aparte-icon name="menu"></aparte-icon></button>
                <span class="aparte-app-header__title" data-aparte-title>{{ $attributes->get('heading') ?: $label }}</span>
                <div class="aparte-app-header__actions">
                    <button type="button" class="{{ $control }}" aria-label="{{ __('New chat') }}" title="{{ __('New chat') }}" data-aparte-new-chat><aparte-icon name="edit"></aparte-icon></button>
                    @if ($attributes->get('maximizable'))
                        <button type="button" class="{{ $control }}" aria-label="{{ __('Maximize') }}" title="{{ __('Maximize') }}" data-aparte-launcher-maximize><aparte-icon name="maximize"></aparte-icon></button>
                    @endif
                    <button type="button" class="{{ $control }}" aria-label="{{ __('Close') }}" title="{{ __('Close') }}" data-aparte-launcher-close><aparte-icon name="close"></aparte-icon></button>
                </div>
            </header>
            <div class="aparte-app-shell__main">
                @include('aparte::partials.element', ['fill' => true])
            </div>
        </div>
    @else
        @include('aparte::partials.element')
    @endif
</aparte-launcher>
