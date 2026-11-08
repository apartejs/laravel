@props(['endpoint', 'thread' => null])

@once
    <link rel="stylesheet" href="{{ route('aparte.asset', ['file' => 'aparte.css', 'v' => \Aparte\Laravel\AparteServiceProvider::assetVersion('aparte.css')]) }}">
    <script type="module" src="{{ route('aparte.asset', ['file' => 'aparte.js', 'v' => \Aparte\Laravel\AparteServiceProvider::assetVersion('aparte.js')]) }}"></script>
@endonce

{{-- wire:ignore: Livewire must not morph what the chat draws. --}}
<div wire:ignore {{ $attributes }}>
    <aparte-chat
        data-aparte-endpoint="{{ url($endpoint) }}"
        data-aparte-csrf="{{ csrf_token() }}"
        @if ($thread) data-aparte-thread="{{ $thread }}" @endif
    >{{ $slot }}</aparte-chat>
</div>
