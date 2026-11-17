<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\People;
use Aparte\Laravel\Streaming\AparteProtocol;
use Illuminate\Http\Request;
use Laravel\Ai\AgentUserInteraction\AgentUserInteraction;
use Laravel\Ai\Approvals\Decision;
use Laravel\Ai\Approvals\Decisions;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Responses\StreamableAgentResponse;
use LogicException;
use Symfony\Component\HttpFoundation\Response;

class ChatController
{
    public function __invoke(Request $request, string $agent): StreamableAgentResponse|Response
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

        // Someone of the team holds the conversation: no assistant answers. The message is kept
        // for them (the browser was told a moment too late to send it to the people route).
        if (People::holder($threadId) !== null) {
            $this->heard($request, $threadId, $chat->message()?->content);

            return (new AparteProtocol($threadId, $chat->runId() ?: null, $request))->nothingToSay();
        }

        $instance = app($agent);

        if (! method_exists($instance, 'continue')) {
            throw new LogicException($agent.' must use the RemembersConversations trait: the chat resumes a conversation on every turn.');
        }

        return $instance
            ->continue($threadId, as: $user)
            ->stream($this->decisions($request) ?? $chat)
            ->usingProtocol(new AparteProtocol($threadId, $chat->runId() ?: null, $request));
    }

    /** The person's message in a held conversation: the id the browser gave it, and its text. */
    private function heard(Request $request, string $threadId, ?string $text): void
    {
        $last = collect($request->input('messages', []))->last(fn ($m) => is_array($m) && ($m['role'] ?? null) === 'user');
        $id = is_array($last) && is_string($last['id'] ?? null) ? $last['id'] : '';

        if (is_string($text) && trim($text) !== '') {
            People::heard($threadId, $id, $text);
        }
    }

    /**
     * A refusal always carries a sentence: the SDK ends the turn on a bare one, and the
     * model would never get to answer it, or to read what the person asked for instead.
     */
    private function decisions(Request $request): ?Decisions
    {
        $resume = $request->input('resume');

        if (! is_array($resume)) {
            return null;
        }

        $decisions = [];

        foreach ($resume as $entry) {
            $id = is_array($entry) ? ($entry['interruptId'] ?? null) : null;

            if (! is_string($id) || $id === '') {
                continue;
            }

            $status = $entry['status'] ?? null;
            $approved = $entry['payload']['approved'] ?? null;

            if ($status === 'resolved' && $approved === true) {
                $decisions[$id] = Decision::approve();
            } elseif ($status === 'cancelled' || ($status === 'resolved' && $approved === false)) {
                $decisions[$id] = Decision::reject($this->refusal($entry['payload']['instruction'] ?? null));
            }
        }

        return $decisions === [] ? null : Decisions::from($decisions);
    }

    private function refusal(mixed $instruction): string
    {
        $said = is_string($instruction) ? trim(mb_substr($instruction, 0, 2000)) : '';

        return $said === ''
            ? 'The user refused this tool call.'
            : 'The user refused this tool call and said: '.$said;
    }
}
