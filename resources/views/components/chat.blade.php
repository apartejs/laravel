@props(['endpoint' => null, 'thread' => null, 'followDarkClass' => false, 'conversations' => null, 'files' => null, 'people' => null, 'peopleButton' => null, 'peopleEmail' => null, 'peopleFiles' => null, 'peopleRating' => null, 'id' => null])

@include('aparte::partials.assets')

{{-- wire:ignore: Livewire must not morph what the chat draws. Its size and place stay here (class, style,
     Livewire's and Alpine's directives); every other attribute is the chat's own (Aparte\Laravel\ChatAttributes). --}}
<div wire:ignore {{ \Aparte\Laravel\ChatAttributes::holder($attributes) }}>
    @include('aparte::partials.element', ['fill' => true, 'chatAttributes' => \Aparte\Laravel\ChatAttributes::chat($attributes)])
</div>
