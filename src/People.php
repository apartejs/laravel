<?php

namespace Aparte\Laravel;

use Aparte\Laravel\Conversations\ConversationRepository;
use Aparte\Laravel\Conversations\DatabaseConversationRepository;
use Aparte\Laravel\Conversations\StoredConversation;
use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonSaw;
use Aparte\Laravel\Events\VisitorLeftEmail;
use Aparte\Laravel\Events\VisitorRated;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\Events\SomeoneWanted;
use Closure;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
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

    private static ?Closure $teamFirst = null;

    private static ?string $filesUri = null;

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
    /** @param  list<array<string, mixed>>  $attachments  what People::attach() kept of the files sent with it */
    public static function heard(string $conversationId, string $messageId, string $text, array $attachments = []): void
    {
        self::remember($conversationId, 'user', $text, attachments: $attachments);

        Event::dispatch(new PersonWrote($conversationId, $messageId, $text, $attachments));
    }

    /**
     * Keeps a file sent in the conversation (config `aparte.people.files`), and says what the chat
     * shows of it: its name, kind, weight and the address to open it at (the people route).
     *
     * @return array{id: string, name: string, type: string, size: int, url: ?string}
     */
    public static function attach(string $conversationId, UploadedFile $file): array
    {
        $id = (string) Str::uuid();
        $name = Str::limit(str_replace(['/', '\\', "\0"], '-', $file->getClientOriginalName()), 120, '') ?: 'file';
        Storage::disk(config('aparte.people.files.disk', 'local'))->putFileAs(self::fileDirectory($conversationId, $id), $file, $name);

        return [
            'id' => $id,
            'name' => $name,
            'type' => $file->getMimeType() ?: 'application/octet-stream',
            'size' => (int) $file->getSize(),
            'url' => self::$filesUri === null ? null : url(self::$filesUri.'/'.rawurlencode($conversationId).'/files/'.$id),
        ];
    }

    /** Where a file of the conversation is on the disk, or null when there is none by that id. */
    public static function filePath(string $conversationId, string $fileId): ?string
    {
        if (! Str::isUuid($fileId)) {
            return null;
        }

        return Storage::disk(config('aparte.people.files.disk', 'local'))->files(self::fileDirectory($conversationId, $fileId))[0] ?? null;
    }

    /** @internal Route::apartePeople() says where its routes are: a file's address is under them. */
    public static function filesUnder(string $uri): void
    {
        self::$filesUri ??= rtrim($uri, '/');
    }

    private static function fileDirectory(string $conversationId, string $fileId): string
    {
        return 'aparte/people/'.$conversationId.'/'.$fileId;
    }

    /**
     * Someone is writing. Without an author, it is the person: your desk asks visitorTyping() for
     * a few seconds. With one, it is someone of your team, and the chat shows "Marie is typing".
     *
     * @param  array<string, mixed>|null  $author
     */
    public static function typing(string $conversationId, ?array $author = null): void
    {
        if ($author === null) {
            Cache::put(self::typingKey($conversationId), true, now()->addSeconds(8));

            return;
        }

        self::announce($conversationId, ['type' => 'typing', 'author' => self::author($author)]);
    }

    /** Whether the person was writing in the conversation a moment ago. */
    public static function visitorTyping(string $conversationId): bool
    {
        return Cache::get(self::typingKey($conversationId)) === true;
    }

    /**
     * The person left an e-mail address, to get your team's answer there too: kept with the
     * conversation, VisitorLeftEmail tells your desk, and the chat draws a notice that says so.
     *
     * @return array<string, mixed> the notice, as the chat draws it
     */
    public static function leftEmail(string $conversationId, string $email): array
    {
        Cache::forever(self::emailKey($conversationId), $email);

        $message = self::message(['kind' => 'notice', 'content' => __('We will also answer you at :email', ['email' => $email])]);
        self::show($conversationId, $message);
        Event::dispatch(new VisitorLeftEmail($conversationId, $email));

        return $message;
    }

    /**
     * Asks the person how the conversation went (the chat's question, `:people-rating="true"`): your
     * desk does it when your team closes the conversation. Asked once; answered with rate().
     */
    public static function askRating(string $conversationId): void
    {
        Cache::forever(self::ratingKey($conversationId), 'asked');
        self::announce($conversationId, ['type' => 'rating']);
    }

    /**
     * The person's answer, `up` or `down`: kept, VisitorRated tells your desk, and the chat thanks them.
     *
     * @return array<string, mixed> the notice, as the chat draws it
     */
    public static function rate(string $conversationId, string $value): array
    {
        Cache::forever(self::ratingKey($conversationId), $value);

        $message = self::message(['kind' => 'notice', 'content' => __('Thank you for your answer')]);
        self::show($conversationId, $message);
        Event::dispatch(new VisitorRated($conversationId, $value));

        return $message;
    }

    /** `asked` while the question waits, then the answer, `up` or `down`; null when nobody asked. */
    public static function rating(string $conversationId): ?string
    {
        $rating = Cache::get(self::ratingKey($conversationId));

        return is_string($rating) ? $rating : null;
    }

    private static function ratingKey(string $conversationId): string
    {
        return 'aparte.people.rating.'.$conversationId;
    }

    /** The e-mail address the person left in the conversation, or null. */
    public static function email(string $conversationId): ?string
    {
        $email = Cache::get(self::emailKey($conversationId));

        return is_string($email) ? $email : null;
    }

    private static function emailKey(string $conversationId): string
    {
        return 'aparte.people.email.'.$conversationId;
    }

    /** The person has seen what your team wrote: PersonSaw tells your desk. */
    public static function saw(string $conversationId): void
    {
        Event::dispatch(new PersonSaw($conversationId));
    }

    private static function typingKey(string $conversationId): string
    {
        return 'aparte.people.typing.'.$conversationId;
    }

    /**
     * A message from someone of your team. The agent reads it under their name ("Marie: …"),
     * since a model's history has no field for who wrote a message.
     *
     * @param  array<string, mixed>  $author
     * @return string the message's id
     */
    /** @param  list<array<string, mixed>>  $attachments  files kept with People::attach(), shown as links to open */
    public static function post(string $conversationId, array $author, string $text, array $attachments = []): string
    {
        $author = self::author($author);
        // The chat draws a team member's files as links (a bubble shows attachments for the person only).
        $links = array_map(fn (array $file): string => '📎 ['.$file['name'].']('.$file['url'].')', $attachments);
        $message = self::message(array_filter([
            'author' => $author,
            'content' => trim($text."\n\n".implode("\n", $links)),
            'attachments' => $attachments ?: null,
        ]));

        $named = array_map(fn (array $file): string => '(file: '.$file['name'].')', $attachments);
        self::remember($conversationId, 'assistant', trim("{$author['name']}: {$text}\n".implode("\n", $named)), $author, $attachments);
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
        self::show($conversationId, self::message(['kind' => 'notice', 'content' => $notice ?? __(':name joined the conversation', ['name' => $author['name']])]));
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
        self::show($conversationId, self::message(['kind' => 'notice', 'content' => $notice ?? __('The assistant is back')]));
        self::announce($conversationId, ['type' => 'auto-reply', 'on' => true]);
    }

    /**
     * The assistant hands the conversation to your team: it stops answering, the chat draws a
     * notice, and SomeoneWanted tells your desk why. It waits until someone takes it over
     * (takeOver) or hands it back (handBack). The AskForSomeone tool calls this.
     *
     * @param  string|null  $notice  the line the chat draws; wantedNotice()'s, else "Someone of the team will answer you here"
     * @param  string  $source  how it came, for your desk (SomeoneWanted::$source): tool, button, message
     * @return array<string, mixed> the notice, as the chat draws it
     */
    public static function want(string $conversationId, string $reason, ?string $notice = null, string $source = 'tool'): array
    {
        Cache::forever(self::wantedKey($conversationId), $reason);

        $notice ??= self::$wantedNotice ? (self::$wantedNotice)($conversationId) : __('Someone of the team will answer you here');
        $message = self::message(['kind' => 'notice', 'content' => $notice]);

        self::announce($conversationId, ['type' => 'auto-reply', 'on' => false]);
        self::show($conversationId, $message);
        Event::dispatch(new SomeoneWanted($conversationId, $reason, $source));

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

    /**
     * Whether your team answers a new conversation before the assistant: while it says yes, a
     * conversation goes to your team at its first message (SomeoneWanted, source `team_first`),
     * and the assistant stays quiet there until someone hands it back. Asked once per
     * conversation, at its first message. A desk can say "while the team is at work":
     * `People::teamFirst(fn (string $conversationId) => $teamIsThere)`. Null: the assistant
     * always answers first.
     *
     * @param  (Closure(string): bool)|null  $resolver
     */
    public static function teamFirst(?Closure $resolver): void
    {
        self::$teamFirst = $resolver;
    }

    /** Whether the team answers this new conversation first (People::teamFirst). */
    public static function teamAnswersFirst(string $conversationId): bool
    {
        return self::$teamFirst !== null && (bool) (self::$teamFirst)($conversationId);
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
    /** @param  list<array<string, mixed>>  $attachments */
    private static function remember(string $conversationId, string $role, string $text, ?array $author = null, array $attachments = []): void
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
            'meta' => ($aparte = array_filter(['author' => $author, 'attachments' => $attachments ?: null])) ? ['aparte' => $aparte] : [],
            'status' => MessageStatus::Completed,
        ]);
    }
}
