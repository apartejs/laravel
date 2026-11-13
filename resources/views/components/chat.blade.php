@props(['endpoint' => null, 'thread' => null, 'followDarkClass' => false, 'conversations' => null, 'id' => null])

@include('aparte::partials.assets')

{{-- wire:ignore: Livewire must not morph what the chat draws. --}}
<div wire:ignore {{ $attributes }}>
    @include('aparte::partials.element', ['fill' => true])
</div>
