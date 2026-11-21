@php
    $composed = isset($emptyState) || isset($aboveComposer) || isset($toolbar);

    // The id the view gave, else its position on the page (a view that drew the list first already has it).
    $chatId ??= \Aparte\Laravel\AparteServiceProvider::chatId($id ?? null);

    // The chat's own attributes, written on the component (Aparte\Laravel\ChatAttributes).
    $chatAttributes ??= new \Illuminate\View\ComponentAttributeBag;
    // What a person may attach, whoever answers (`files`): the paperclip, and its types.
    $filesTypes = \Aparte\Laravel\ChatAttributes::files($files ?? null);
    // `:attachments="false"` is written in the bag but draws nothing: on, it is the page's own paperclip.
    $ownPaperclip = \Aparte\Laravel\ChatAttributes::on($chatAttributes, 'attachments');
    $paperclip = $filesTypes !== null || $ownPaperclip;
@endphp

<aparte-chat
    id="{{ $chatId }}"
    {{ $chatAttributes }}
    @if ($filesTypes !== null) @unless ($ownPaperclip) attachments @endunless data-aparte-files="{{ $filesTypes }}" @endif
    data-aparte-endpoint="{{ ($endpoint ?? null) ? url($endpoint) : '' }}"
    data-aparte-csrf="{{ csrf_token() }}"
    data-aparte-scope="{{ auth()->id() }}"
    {{-- The page's language, for the chat's own words (@aparte/locales); its other lines go through Laravel's translator. --}}
    data-aparte-locale="{{ app()->getLocale() }}"
    {{-- One named conversation, for someone signed in: guests would all share it, and the model's memory with it. --}}
    @if (($thread ?? null) && auth()->check()) data-aparte-thread="{{ $thread }}" @endif
    {{-- Kept on the server for someone signed in; a guest's conversations stay in the tab. --}}
    @if (($conversations ?? null) && auth()->check()) data-aparte-conversations="{{ url($conversations) }}" @endif
    {{-- Someone of the team can take the conversation over (People): who holds it, and what the person writes meanwhile. --}}
    @if ($people ?? null) data-aparte-people="{{ url($people) }}" data-aparte-people-typing="{{ __(':name is typing…') }}" @endif
    {{-- The visitor's own way to ask for someone of the team, beside send: only when the app turns it on,
         since something has to hear SomeoneWanted (a desk) or the visitor waits for nobody. --}}
    @if (($people ?? null) && filled($peopleButton ?? null) && ($peopleButton ?? null) !== false) data-aparte-people-button="{{ is_string($peopleButton) ? $peopleButton : __('Talk to a person') }}" @endif
    {{-- A field to get the team's answer by e-mail while the conversation waits for it: only when the app turns
         it on (a desk writes to that address), and only for a guest, whose address nobody knows. --}}
    @if (($people ?? null) && ($peopleEmail ?? false) && ! auth()->check()) data-aparte-people-email="{{ __('Get the answer by e-mail too') }}" data-aparte-people-email-placeholder="{{ __('Your e-mail') }}" data-aparte-people-email-send="{{ __('Send') }}" @endif
    {{-- The paperclip while someone of the team is in the conversation: files kept on your disk (aparte.people.files). --}}
    @if (($people ?? null) && ($peopleFiles ?? false) && \Aparte\Laravel\People::filesEnabled()) data-aparte-people-files="{{ collect(config('aparte.people.files.types', []))->map(fn ($type) => '.'.$type)->implode(',') }}" @endif
    {{-- How the conversation went, asked when your team closes it: only when the app turns it on (a desk keeps it). --}}
    @if (($people ?? null) && ($peopleRating ?? false)) data-aparte-people-rating="{{ __('How was this conversation?') }}" data-aparte-people-rating-up="{{ __('Good') }}" data-aparte-people-rating-down="{{ __('Not good') }}" @endif
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
        {{-- The composer aparté writes when it writes its own, with the slots added: the paperclip and its strip
             when files are on, the chat's placeholder and `disabled`. aparté keeps the paperclip in step only in a
             composer it wrote, so aparte.js does it in this one (data-aparte-laravel-shell). --}}
        {{-- Written by the bag, as on the chat: the same escaping, and nothing for a value bound to false. --}}
        <aparte-composer {{ $chatAttributes->only(['placeholder', 'disabled']) }}>
            <div class="aparte-composer-shell" data-aparte-laravel-shell>
                @if ($paperclip)
                    <aparte-composer-attachments></aparte-composer-attachments>
                @endif
                <div class="aparte-composer-row">
                    @if ($paperclip)
                        <aparte-composer-add-attachment></aparte-composer-add-attachment>
                    @endif
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
