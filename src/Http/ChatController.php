<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\ChatModels;
use Aparte\Laravel\Conversations\ShownBranch;
use Aparte\Laravel\Conversations\ShownBranchStore;
use Aparte\Laravel\People;
use Aparte\Laravel\Streaming\AparteProtocol;
use Illuminate\Http\Request;
use Laravel\Ai\AgentUserInteraction\AgentUserInteraction;
use Laravel\Ai\Approvals\Decision;
use Laravel\Ai\Approvals\Decisions;
use Laravel\Ai\Contracts\ConversationStore;
use Illuminate\Support\Str;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Models\ConversationMessage;
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

        $held = People::holder($threadId) !== null || People::wanted($threadId) !== null;

        // A new conversation your team answers first while it is there (People::teamFirst): its
        // first message is kept for them, then it goes to the team, before any answer.
        if (! $held && ! ConversationMessage::query()->where('conversation_id', $threadId)->exists()
            && People::teamAnswersFirst($threadId)) {
            $text = (string) $chat->message()?->content;
            $this->heard($request, $threadId, $text);
            People::want($threadId, Str::limit($text, 200), source: 'team_first');

            return (new AparteProtocol($threadId, $chat->runId() ?: null, $request))->nothingToSay();
        }

        // Someone of the team holds the conversation: no assistant answers. The message is kept
        // for them (the browser was told a moment too late to send it to the people route).
        if ($held) {
            $this->heard($request, $threadId, $chat->message()?->content);
            People::announce($threadId, ['type' => 'auto-reply', 'on' => false]);

            return (new AparteProtocol($threadId, $chat->runId() ?: null, $request))->nothingToSay();
        }

        $instance = app($agent);

        if (! method_exists($instance, 'continue')) {
            throw new LogicException($agent.' must use the RemembersConversations trait: the chat resumes a conversation on every turn.');
        }

        People::answering($threadId);

        // What the person sees, for the model's memory to follow after a retry, an edit or a branch they went back
        // to (ShownBranchStore): the ids of the messages on screen, and of the person's message this turn answers.
        app(ShownBranch::class)->follow($threadId, $request->input('forwardedProps.aparte'));
        $decisions = $this->decisions($request);
        // A retry or an edit asks a message again, which the chat sends without its files (and without itself when
        // it was only a picture): the one kept from its first sending stands in, with them (ShownBranchStore).
        $store = app(ConversationStore::class);
        $again = ! $request->has('resume') && $store instanceof ShownBranchStore ? $store->askedAgain($threadId) : null;

        // The model the person chose in the chat, when this route takes a choice and lists it (ChatModels): else
        // the agent's own, as in a chat that offers none.
        [$provider, $model] = ChatModels::chosen($request->route(), $request->input('forwardedProps.model')) ?? [null, null];

        return $instance
            ->continue($threadId, as: $user)
            ->stream($decisions ?? $again ?? $chat, provider: $provider, model: $model)
            ->usingProtocol(new AparteProtocol($threadId, $chat->runId() ?: null, $request));
    }

    /** The person's message in a held conversation: the id the browser gave it, and its text. */
    private function heard(Request $request, string $threadId, ?string $text): void
    {
        $last = collect($request->input('messages', []))->last(fn ($m) => is_array($m) && ($m['role'] ?? null) === 'user');
        $id = is_array($last) && is_string($last['id'] ?? null) ? $last['id'] : '';

        // PersonWrote always carries the browser's id, which "Read by" needs. AG-UI gives every
        // message one, and the chat always does: a message without one is not heard.
        if ($id !== '' && is_string($text) && trim($text) !== '') {
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
