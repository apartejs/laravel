@php
    $composed = isset($emptyState) || isset($aboveComposer) || isset($toolbar);

    // The id the view gave, else its position on the page (a view that drew the list first already has it).
    $chatId ??= \Aparte\Laravel\AparteServiceProvider::chatId($id ?? null);
@endphp

<aparte-chat
    id="{{ $chatId }}"
    data-aparte-endpoint="{{ ($endpoint ?? null) ? url($endpoint) : '' }}"
    data-aparte-csrf="{{ csrf_token() }}"
    data-aparte-scope="{{ auth()->id() }}"
    @if ($thread ?? null) data-aparte-thread="{{ $thread }}" @endif
    {{-- Kept on the server for someone signed in; a guest's conversations stay in the tab. --}}
    @if (($conversations ?? null) && auth()->check()) data-aparte-conversations="{{ url($conversations) }}" @endif
    @if ($followDarkClass ?? false) data-aparte-follow-dark @endif
    @if ($fill ?? false) style="height: 100%" @endif
>
    @if ($composed)
        <aparte-chat-viewport>
            @isset($emptyState)
                <div data-aparte-empty-state>{{ $emptyState }}</div>
            @endisset
        </aparte-chat-viewport>
        <aparte-elicitation></aparte-elicitation>
        {{ $aboveComposer ?? '' }}
        <aparte-composer>
            <div class="aparte-composer-shell">
                <div class="aparte-composer-row">
                    <aparte-composer-input></aparte-composer-input>
                    <aparte-composer-send></aparte-composer-send>
                </div>
                @isset($toolbar)
                    <aparte-composer-toolbar>{{ $toolbar }}</aparte-composer-toolbar>
                @endisset
            </div>
        </aparte-composer>
    @endif
</aparte-chat>
