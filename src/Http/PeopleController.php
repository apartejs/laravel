<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\People;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
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
            return response()->json(['heldBy' => null, 'wanted' => false, 'emailLeft' => false, 'channel' => People::channel($conversation, $request->user()?->getKey())]);
        }

        $this->authorize($request, $found);

        return response()->json([
            'heldBy' => People::holder($conversation),
            'wanted' => People::wanted($conversation) !== null,
            'emailLeft' => People::email($conversation) !== null,
            'channel' => People::channel($conversation, $found->participant_id),
        ]);
    }

    /**
     * What the person writes to your team. In a chat without an assistant (no `endpoint`), the
     * first message starts the conversation and puts it in your team's queue, the message as the
     * reason; the visitor reads the notice the hand-off gives.
     */
    public function store(Request $request, string $conversation): Response|JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:64'],
            'content' => ['required', 'string', 'max:20000'],
        ]);

        // The browser mints the thread id, as for the chat route.
        $user = $request->user();
        $found = Conversation::firstOrCreate(['id' => $conversation], [
            'participant_type' => $user?->getMorphClass(),
            'participant_id' => $user?->getKey(),
            'title' => Str::limit($data['content'], 60),
        ]);
        $this->authorize($request, $found);

        People::heard($conversation, $data['id'], $data['content']);

        // Nobody holds it and it waits for nobody: writing to the team is asking for it.
        if (People::holder($conversation) === null && People::wanted($conversation) === null) {
            return response()->json(['notice' => People::want($conversation, Str::limit($data['content'], 200), source: 'message')]);
        }

        return response()->noContent();
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

        $data = $request->validate(['email' => ['required', 'string', 'email', 'max:254']]);

        return response()->json(['notice' => People::leftEmail($conversation, $data['email'])]);
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
