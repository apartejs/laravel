<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\People;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Laravel\Ai\Models\Conversation;

/**
 * The two routes of `Route::apartePeople()`: who holds a conversation, read by the chat when it
 * opens one, and what the person writes while someone does, since no assistant request carries it.
 */
class PeopleController
{
    public function show(Request $request, string $conversation): JsonResponse
    {
        $found = Conversation::find($conversation);

        // A conversation that is not there yet has had no one take it over, and will be the
        // participant's who asks: the channel is theirs already.
        if ($found === null) {
            return response()->json(['heldBy' => null, 'wanted' => false, 'emailLeft' => false, 'rating' => null, 'channel' => People::channel($conversation, $request->user()?->getKey())]);
        }

        $this->authorize($request, $found);

        return response()->json([
            'heldBy' => People::holder($conversation),
            'wanted' => People::wanted($conversation) !== null,
            'emailLeft' => People::email($conversation) !== null,
            'rating' => People::rating($conversation),
            'channel' => People::channel($conversation, $found->participant_id),
        ]);
    }

    /**
     * What the person writes to your team. In a chat without an assistant (no `endpoint`, the chat
     * sends `team: true`), the first message starts the conversation and puts it in your team's
     * queue, the message as the reason; the visitor reads the notice the hand-off gives. In a chat
     * with an assistant, a conversation nobody holds and that waits for nobody is the
     * assistant's: refused (409), and nothing is created, kept or handed over.
     */
    public function store(Request $request, string $conversation): Response|JsonResponse
    {
        $files = config('aparte.people.files');
        $data = $request->validate([
            'id' => ['required', 'string', 'max:64'],
            'content' => ['nullable', 'string', 'max:20000', 'required_without:files'],
            'team' => ['sometimes', 'boolean'],
            // Files only when your app turned them on: the paperclip is the page's, not the server's.
            'files' => People::filesEnabled() ? ['nullable', 'array', 'max:'.(int) ($files['max'] ?? 5)] : ['prohibited'],
            'files.*' => ['file', 'max:'.(int) ($files['max_kb'] ?? 10240), 'mimes:'.implode(',', $files['types'] ?? [])],
        ]);
        $text = (string) ($data['content'] ?? '');
        $teamOnly = $request->boolean('team');

        $found = Conversation::find($conversation);
        if ($found !== null) {
            $this->authorize($request, $found);
        }
        $waiting = $found !== null && (People::holder($conversation) !== null || People::wanted($conversation) !== null);

        // The assistant's conversation: the chat sends here only while someone holds it or it
        // waits for someone. Anything else is not a message for the team.
        abort_unless($waiting || $teamOnly, 409, 'The assistant answers this conversation.');

        // The browser mints the thread id, as for the chat route: a chat with the team only starts here.
        if ($found === null) {
            $user = $request->user();
            $found = Conversation::create([
                'id' => $conversation,
                'participant_type' => $user?->getMorphClass(),
                'participant_id' => $user?->getKey(),
                'title' => $text !== '' ? Str::limit($text, 60) : 'aparté chat',
            ]);
        }

        $attachments = array_map(fn ($file) => People::attach($conversation, $file), $request->file('files', []));
        People::heard($conversation, $data['id'], $text, $attachments);

        // A chat with the team only, nobody holding it and nobody asked yet: writing is asking.
        if (! $waiting) {
            $reason = $text !== '' ? Str::limit($text, 200) : implode(', ', array_column($attachments, 'name'));

            return response()->json(['notice' => People::want($conversation, $reason, source: 'message'), 'attachments' => $attachments]);
        }

        // The files' addresses, for the chat to show them from here on, rather than from the browser's memory.
        return $attachments === [] ? response()->noContent() : response()->json(['attachments' => $attachments]);
    }

    /**
     * The visitor asks for someone of your team, with the chat's button: the conversation goes to
     * your team as when the assistant hands it over, without asking the model. Someone holding it
     * already, or it already waiting, changes nothing.
     */
    public function want(Request $request, string $conversation): JsonResponse
    {
        $user = $request->user();

        // The browser mints the thread id, as for the chat route: a conversation not written yet
        // is the visitor's, as their first message would have made it.
        $found = Conversation::firstOrCreate(['id' => $conversation], [
            'participant_type' => $user?->getMorphClass(),
            'participant_id' => $user?->getKey(),
            'title' => 'aparté chat',
        ]);
        $this->authorize($request, $found);

        if (People::holder($conversation) !== null || People::wanted($conversation) !== null) {
            return response()->json(['notice' => null]);
        }

        return response()->json(['notice' => People::want($conversation, __('The visitor asked for a person'), source: 'button')]);
    }

    /** The person is writing, while someone of your team is in the conversation. */
    /**
     * The person leaves an e-mail address, to get your team's answer there too (the chat's field,
     * `:people-email="true"`): kept with the conversation, and VisitorLeftEmail tells your desk.
     */
    public function email(Request $request, string $conversation): JsonResponse
    {
        $found = Conversation::find($conversation);
        abort_if($found === null, 404);
        $this->authorize($request, $found);

        // A guest's, once, while an answer from your team is owed: someone signed in has an
        // address already, and a second one would let anyone have your desk write to a stranger.
        abort_if($request->user() !== null, 403, 'Someone signed in is not asked for an address.');
        abort_if(People::email($conversation) !== null, 409, 'An address was left already.');
        abort_if(People::holder($conversation) === null && People::wanted($conversation) === null, 409, 'Nobody of the team is awaited.');

        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:254']]);

        return response()->json(['notice' => People::leftEmail($conversation, $data['email'])]);
    }

    /** The person says how the conversation went, when your team asked (People::askRating): once. */
    public function rating(Request $request, string $conversation): JsonResponse
    {
        $found = Conversation::find($conversation);
        abort_if($found === null, 404);
        $this->authorize($request, $found);
        $data = $request->validate(['value' => ['required', 'string', 'in:up,down']]);

        // Once, even for two answers sent at the same moment.
        $notice = Cache::lock('aparte.people.rating-lock.'.$conversation, 5)->get(
            fn () => People::rating($conversation) === 'asked' ? People::rate($conversation, $data['value']) : null,
        );
        abort_if($notice === null || $notice === false, 409, 'Nobody asked for a rating, or it was given.');

        return response()->json(['notice' => $notice]);
    }

    /** A file sent in the conversation, for whoever may read it: never run by the browser. */
    public function file(Request $request, string $conversation, string $file): mixed
    {
        $found = Conversation::find($conversation);
        abort_if($found === null, 404);
        $this->authorize($request, $found);

        $path = People::filePath($conversation, $file);
        abort_if($path === null, 404);

        $disk = Storage::disk(config('aparte.people.files.disk', 'local'));
        // Opened in the browser: pictures and PDFs it cannot run. Anything else, an SVG included, downloads.
        $inline = in_array($disk->mimeType($path), ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'], true);

        return $disk->response($path, basename($path), ['X-Content-Type-Options' => 'nosniff'], $inline ? 'inline' : 'attachment');
    }

    public function typing(Request $request, string $conversation): Response
    {
        $found = Conversation::find($conversation);
        abort_if($found === null, 404);
        $this->authorize($request, $found);

        People::typing($conversation);

        return response()->noContent();
    }

    /** The person has seen what your team wrote. */
    public function seen(Request $request, string $conversation): Response
    {
        $found = Conversation::find($conversation);
        abort_if($found === null, 404);
        $this->authorize($request, $found);

        People::saw($conversation);

        return response()->noContent();
    }

    /** The conversation's own participant, as the chat route checks it: a guest's is a guest's. */
    private function authorize(Request $request, Conversation $conversation): void
    {
        $user = $request->user();

        abort_unless(
            $conversation->participant_type === $user?->getMorphClass()
                && (string) $conversation->participant_id === (string) $user?->getKey(),
            403,
        );
    }
}
