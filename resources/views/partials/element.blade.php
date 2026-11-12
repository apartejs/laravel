@php
    $composed = isset($emptyState) || isset($aboveComposer) || isset($toolbar);

    // By position on the page, per request: the same chat keeps its id, and its conversation, from one load to the next.
    $position = request()->attributes->get('aparte.chats', 0) + 1;
    request()->attributes->set('aparte.chats', $position);
@endphp

<aparte-chat
    id="aparte-chat-{{ $position }}"
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
