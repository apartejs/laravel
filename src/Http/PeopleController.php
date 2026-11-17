<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\People;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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

        // A conversation that is not there yet has had no one take it over.
        if ($found === null) {
            return response()->json(['heldBy' => null]);
        }

        $this->authorize($request, $found);

        return response()->json(['heldBy' => People::holder($conversation)]);
    }

    public function store(Request $request, string $conversation): Response
    {
        $found = Conversation::find($conversation);
        abort_if($found === null, 404);
        $this->authorize($request, $found);

        $data = $request->validate([
            'id' => ['required', 'string', 'max:64'],
            'content' => ['required', 'string', 'max:20000'],
        ]);

        People::heard($conversation, $data['id'], $data['content']);

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
