@props(['endpoint' => null, 'thread' => null, 'label' => 'Chat', 'followDarkClass' => false])

@include('aparte::partials.assets')

{{-- The button that floats in a corner of the page and opens the chat above it. --}}
<aparte-launcher label="{{ $label }}" wire:ignore {{ $attributes }}>
    @include('aparte::partials.element')
</aparte-launcher>
