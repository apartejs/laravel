<?php

namespace Aparte\Laravel;

use Aparte\Laravel\Events\PersonWrote;
use Closure;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Laravel\Ai\Enums\MessageStatus;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Models\ConversationMessage;

/**
 * People in a conversation beside the assistant, or instead of it: someone of your team who
 * takes it over, answers, and hands it back.
 *
 * Who holds a conversation is your desk's to know: the package asks it (heldBy), and never
 * stores it. What a person writes goes into the agent's memory too, so the assistant has read
 * it when it answers again.
 */
final class People
{
    /** @var (Closure(string): (array<string, mixed>|null))|null */
    private static ?Closure $heldBy = null;

    /**
     * Tell the package who holds a conversation: the callback receives its id and returns the
     * person — `['name' => 'Marie', 'avatar' => '…', 'id' => '…']` — or null when the assistant
     * answers it. Null removes the callback: nobody holds anything.
     *
     * @param  (Closure(string): (array<string, mixed>|null))|null  $resolver
     */
    public static function heldBy(?Closure $resolver): void
    {
        self::$heldBy = $resolver;
    }

    /**
     * Who holds the conversation now, as an aparté author (`name`, `type`, and `avatar` and
     * `id` when given), or null when the assistant answers it.
     *
     * @return array{name: string, type: string, avatar?: string, id?: string}|null
     */
    public static function holder(string $conversationId): ?array
    {
        $held = self::$heldBy ? (self::$heldBy)($conversationId) : null;

        return $held === null ? null : self::author($held);
    }

    /**
     * The person wrote while someone holds the conversation: the message goes into the agent's
     * memory, and PersonWrote tells your desk.
     */
    public static function heard(string $conversationId, string $messageId, string $text): void
    {
        self::remember($conversationId, 'user', $text);

        Event::dispatch(new PersonWrote($conversationId, $messageId, $text));
    }

    /**
     * A message from someone of your team. The agent reads it under their name ("Marie: …"),
     * since a model's history has no field for who wrote a message.
     *
     * @param  array<string, mixed>  $author
     * @return string the message's id
     */
    public static function post(string $conversationId, array $author, string $text): string
    {
        $author = self::author($author);
        $id = (string) Str::uuid7();

        self::remember($conversationId, 'assistant', "{$author['name']}: {$text}", $author);

        return $id;
    }

    /**
     * @param  array<string, mixed>  $author
     * @return array{name: string, type: string, avatar?: string, id?: string}
     */
    private static function author(array $author): array
    {
        $name = $author['name'] ?? null;

        if (! is_string($name) || trim($name) === '') {
            throw new InvalidArgumentException('A person in the conversation needs a name: the chat shows it over their messages.');
        }

        $type = $author['type'] ?? 'human';

        return array_filter([
            'name' => $name,
            'type' => in_array($type, ['ai', 'human'], true) ? $type : 'human',
            'avatar' => is_string($author['avatar'] ?? null) ? $author['avatar'] : null,
            'id' => isset($author['id']) ? (string) $author['id'] : null,
        ], fn ($value) => $value !== null);
    }

    /**
     * A row of the agent's memory, the way the Laravel AI SDK stores its own: the user's text
     * in `content`, an assistant's in one step (the SDK reads an assistant turn from its steps).
     *
     * @param  array<string, string>|null  $author
     */
    private static function remember(string $conversationId, string $role, string $text, ?array $author = null): void
    {
        $conversation = Conversation::findOrFail($conversationId);
        $latest = ConversationMessage::query()->where('conversation_id', $conversationId)->orderByDesc('id')->first();

        ConversationMessage::create([
            'id' => (string) Str::uuid7(),
            'conversation_id' => $conversationId,
            'participant_type' => $conversation->participant_type,
            'participant_id' => $conversation->participant_id,
            'agent' => $latest->agent ?? '',
            'role' => $role,
            'content' => $text,
            'attachments' => [],
            'steps' => $role === 'assistant'
                ? [['content' => $text, 'tool_calls' => [], 'reasoning' => '', 'replay_blocks' => [], 'provider_tool_calls' => []]]
                : [],
            'usage' => [],
            'meta' => $author ? ['aparte' => ['author' => $author]] : [],
            'status' => MessageStatus::Completed,
        ]);
    }
}
