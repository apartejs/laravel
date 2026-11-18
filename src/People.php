<?php

namespace Aparte\Laravel;

use Aparte\Laravel\Conversations\ConversationRepository;
use Aparte\Laravel\Conversations\DatabaseConversationRepository;
use Aparte\Laravel\Conversations\StoredConversation;
use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\Events\SomeoneWanted;
use Closure;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
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

    /** @var (Closure(string): string)|null */
    private static ?Closure $wantedNotice = null;

    /** The conversation the chat route is answering right now, for a tool to know where it runs. */
    private static ?string $answering = null;

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
        $message = self::message(['author' => $author, 'content' => $text]);

        self::remember($conversationId, 'assistant', "{$author['name']}: {$text}", $author);
        self::show($conversationId, $message);

        return $message['id'];
    }

    /**
     * Someone of your team takes the conversation over: the chat stops the assistant from
     * answering in it, and draws a notice. Who holds it stays yours to keep (heldBy): update it
     * first, then call this.
     *
     * @param  array<string, mixed>  $author
     * @param  string|null  $notice  the line the chat draws; "Marie joined the conversation" by default
     */
    public static function takeOver(string $conversationId, array $author, ?string $notice = null): void
    {
        $author = self::author($author);
        Cache::forget(self::wantedKey($conversationId));

        self::announce($conversationId, ['type' => 'auto-reply', 'on' => false]);
        self::show($conversationId, self::message(['kind' => 'notice', 'content' => $notice ?? "{$author['name']} joined the conversation"]));
    }

    /**
     * A short line under a message of the conversation — "Read by Marie". The id is the one the
     * chat gave the message (`messageId` of PersonWrote, `detail.messageId` in the browser).
     */
    public static function read(string $conversationId, string $messageId, string $note): void
    {
        self::store($conversationId, fn (string $json) => StoredConversation::withChange($json, $messageId, ['note' => $note]));
        self::announce($conversationId, ['type' => 'note', 'messageId' => $messageId, 'note' => $note]);
    }

    /**
     * The conversation goes back to the assistant: a notice, and the assistant answers the
     * next message, having read what was written meanwhile.
     *
     * @param  string|null  $notice  the line the chat draws; "The assistant is back" by default
     */
    public static function handBack(string $conversationId, ?string $notice = null): void
    {
        Cache::forget(self::wantedKey($conversationId));
        self::show($conversationId, self::message(['kind' => 'notice', 'content' => $notice ?? 'The assistant is back']));
        self::announce($conversationId, ['type' => 'auto-reply', 'on' => true]);
    }

    /**
     * The assistant hands the conversation to your team: it stops answering, the chat draws a
     * notice, and SomeoneWanted tells your desk why. It waits until someone takes it over
     * (takeOver) or hands it back (handBack). The AskForSomeone tool calls this.
     *
     * @param  string|null  $notice  the line the chat draws; wantedNotice()'s, else "Someone of the team will answer you here"
     * @return array<string, mixed> the notice, as the chat draws it
     */
    public static function want(string $conversationId, string $reason, ?string $notice = null): array
    {
        Cache::forever(self::wantedKey($conversationId), $reason);

        $notice ??= self::$wantedNotice ? (self::$wantedNotice)($conversationId) : 'Someone of the team will answer you here';
        $message = self::message(['kind' => 'notice', 'content' => $notice]);

        self::announce($conversationId, ['type' => 'auto-reply', 'on' => false]);
        self::show($conversationId, $message);
        Event::dispatch(new SomeoneWanted($conversationId, $reason));

        return $message;
    }

    /**
     * What the visitor reads when the conversation goes to your team, whoever asked: the
     * assistant (AskForSomeone) or the visitor (the chat's button). Your desk can say when the
     * team is back: `People::wantedNotice(fn (string $id) => ...)`.
     *
     * @param  (Closure(string): string)|null  $resolver
     */
    public static function wantedNotice(?Closure $resolver): void
    {
        self::$wantedNotice = $resolver;
    }

    /** Why the conversation waits for someone of your team, or null when it does not. */
    public static function wanted(string $conversationId): ?string
    {
        $reason = Cache::get(self::wantedKey($conversationId));

        return is_string($reason) ? $reason : null;
    }

    /** The chat route says which conversation it answers, for the duration of the answer. */
    public static function answering(?string $conversationId = null): ?string
    {
        if (func_num_args() > 0) {
            self::$answering = $conversationId;
        }

        return self::$answering;
    }

    private static function wantedKey(string $conversationId): string
    {
        return 'aparte.people.wanted.'.$conversationId;
    }

    /**
     * Tell the chat now, on the conversation's private channel.
     *
     * @param  array<string, mixed>  $change
     */
    public static function announce(string $conversationId, array $change): void
    {
        $participantId = Conversation::find($conversationId)?->participant_id;

        Event::dispatch(new ConversationChanged($conversationId, $change, self::channel($conversationId, $participantId)));
    }

    /**
     * The channel the chat listens on for a conversation, which the people route gives it. A
     * signed-in person's conversation is private, `aparte.conversations.{id}` (authorize it with
     * owns()). A guest has no one to authorize, so theirs is public, under a name made from the
     * conversation's id and your app key, which nobody can work out without the key.
     *
     * @return array{name: string, private: bool}
     */
    public static function channel(string $conversationId, string|int|null $participantId): array
    {
        $name = 'aparte.conversations.'.$conversationId;

        if ($participantId !== null) {
            return ['name' => $name, 'private' => true];
        }

        return ['name' => $name.'.'.substr(hash_hmac('sha256', $name, (string) config('app.key')), 0, 40), 'private' => false];
    }

    /**
     * Whether a conversation is this person's: what a private channel's authorization asks.
     *
     * `Broadcast::channel('aparte.conversations.{id}', fn ($user, string $id) => People::owns($user, $id));`
     */
    public static function owns(Authenticatable $user, string $conversationId): bool
    {
        $conversation = Conversation::find($conversationId);

        return $conversation !== null
            && $conversation->participant_type === ($user instanceof Model ? $user->getMorphClass() : null)
            && (string) $conversation->participant_id === (string) $user->getAuthIdentifier();
    }

    /**
     * An aparté message on the assistant's side.
     *
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    private static function message(array $fields): array
    {
        return ['id' => (string) Str::uuid7(), 'role' => 'assistant', ...$fields, 'timestamp' => (int) floor(microtime(true) * 1000)];
    }

    /**
     * A message in the conversation the chat reopens, then on screen now.
     *
     * @param  array<string, mixed>  $message
     */
    private static function show(string $conversationId, array $message): void
    {
        self::store($conversationId, fn (string $json) => StoredConversation::withMessage($json, $message));
        self::announce($conversationId, ['type' => 'message', 'message' => $message]);
    }

    /**
     * Change the conversation as the package's repository keeps it, for its participant. A
     * repository of your own is not written to: keep it from PersonWrote and ConversationChanged.
     */
    private static function store(string $conversationId, Closure $change): void
    {
        $repository = app(ConversationRepository::class);
        $conversation = Conversation::find($conversationId);

        // A guest's conversations stay in their browser: there is nothing kept to write to.
        if ($repository instanceof DatabaseConversationRepository && $conversation?->participant_type !== null) {
            $repository->changeInEveryScope($conversation->participant_type, (string) $conversation->participant_id, $conversationId, $change);
        }
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
