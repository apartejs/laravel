<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\Streaming\AparteProtocol;
use Illuminate\Http\Request;
use Laravel\Ai\AgentUserInteraction\AgentUserInteraction;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Responses\StreamableAgentResponse;

class ChatController
{
    public function __invoke(Request $request, string $agent): StreamableAgentResponse
    {
        $chat = AgentUserInteraction::chat($request);
        $threadId = $chat->threadId();
        abort_if($threadId === '' || strlen($threadId) > 36, 422, 'A thread id is required.');

        $user = $request->user();

        // The browser mints the thread id, so it is adopted as the conversation's id.
        $conversation = Conversation::firstOrCreate(['id' => $threadId], [
            'participant_type' => $user?->getMorphClass(),
            'participant_id' => $user?->getKey(),
            'title' => 'aparté chat',
        ]);

        // A thread id comes from the browser: it must not open someone else's conversation.
        abort_unless(
            $conversation->participant_type === $user?->getMorphClass()
                && (string) $conversation->participant_id === (string) $user?->getKey(),
            403,
        );

        return app($agent)
            ->continue($threadId, as: $user)
            ->stream($chat)
            ->usingProtocol(new AparteProtocol($threadId, $chat->runId() ?: null));
    }
}
