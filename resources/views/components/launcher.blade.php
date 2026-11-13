@props(['endpoint' => null, 'thread' => null, 'label' => 'Chat', 'followDarkClass' => false, 'conversations' => null, 'list' => false, 'id' => null])

@include('aparte::partials.assets')

@php
    // A list shows conversations: the ones kept for someone signed in, or the chat's own (the
    // tab's, or a storage of the app's) when the view asks for the list.
    $history = $list || ($conversations && auth()->check());
    $control = 'aparte-btn aparte-btn--icon aparte-btn--ghost';
    $heading = $attributes->get('heading') ?: $label;
    // Known before the chat is drawn: the list names the chat it drives.
    $chatId = $history ? \Aparte\Laravel\AparteServiceProvider::chatId($id) : null;
@endphp

{{-- The button that floats in a corner of the page and opens the chat above it. --}}
<aparte-launcher label="{{ $label }}" wire:ignore {{ $attributes }}>
    @if ($history)
        {{-- With its list, the chat is a card of its own: the list in a drawer (a column once the chat fills the
             window), and a header that names the conversation and starts a new one. A section, so that this header
             is the card's and not a second banner for the page. --}}
        <section class="aparte-app-shell">
            <aparte-sidebar>
                <div class="aparte-sidebar__header">
                    <span class="aparte-sidebar__brand">{{ __('Conversations') }}</span>
                    <button type="button" class="{{ $control }}" aria-label="{{ __('New chat') }}" title="{{ __('New chat') }}" data-aparte-new-chat><aparte-icon name="edit"></aparte-icon></button>
                </div>
                <div class="aparte-sidebar__search">
                    <input type="search" class="aparte-field aparte-field--sm" placeholder="{{ __('Search chats') }}" aria-label="{{ __('Search chats') }}" data-aparte-sidebar-search>
                </div>
                <div class="aparte-sidebar__body">
                    <aparte-conversation-list target="{{ $chatId }}" manage></aparte-conversation-list>
                </div>
            </aparte-sidebar>
            <header class="aparte-app-header">
                <button type="button" class="{{ $control }} aparte-app-header__toggle" aria-label="{{ __('Conversations') }}" title="{{ __('Conversations') }}" data-aparte-sidebar-toggle><aparte-icon name="menu"></aparte-icon></button>
                {{-- The launcher draws no header over a card that has one: its title and the line under it are drawn here. --}}
                <div class="aparte-launcher__heading">
                    <span class="aparte-app-header__title" data-aparte-title="{{ $heading }}">{{ $heading }}</span>
                    @if ($attributes->get('subheading'))
                        <span class="aparte-launcher__subheading">{{ $attributes->get('subheading') }}</span>
                    @endif
                </div>
                <div class="aparte-app-header__actions">
                    <button type="button" class="{{ $control }}" aria-label="{{ __('New chat') }}" title="{{ __('New chat') }}" data-aparte-new-chat><aparte-icon name="edit"></aparte-icon></button>
                    @if ($attributes->get('maximizable'))
                        <button type="button" class="{{ $control }}" aria-label="{{ __('Maximize') }}" title="{{ __('Maximize') }}" data-aparte-launcher-maximize><aparte-icon name="maximize"></aparte-icon></button>
                    @endif
                    <button type="button" class="{{ $control }}" aria-label="{{ __('Close') }}" title="{{ __('Close') }}" data-aparte-launcher-close><aparte-icon name="close"></aparte-icon></button>
                </div>
            </header>
            <div class="aparte-app-shell__main">
                @include('aparte::partials.element', ['fill' => true, 'chatId' => $chatId])
            </div>
        </section>
    @else
        @include('aparte::partials.element')
    @endif
</aparte-launcher>
