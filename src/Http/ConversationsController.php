<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\Conversations\ConversationRepository;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laravel\Ai\Models\Conversation;
use stdClass;

/**
 * The conversations a chat shows, kept for the person signed in: five routes on one address
 * (`Route::aparteConversations()`). What is kept is what the browser sent, as it sent it, and it
 * is only ever given back to the person it was kept for, through the routes it was kept by.
 */
class ConversationsController
{
    /** What a PATCH may change without the messages travelling. */
    private const CHANGES = ['title', 'pinnedAt', 'archivedAt'];

    /** What a change may weigh: a title and two dates, with room for a title written in escapes. */
    private const CHANGE_BYTES = 8 * 1024;

    /** What the list shows of a title, and what a rename keeps of one. */
    private const TITLE_LENGTH = 255;

    /** The largest whole number the chat can write: JavaScript's, which every column here holds. */
    private const LATEST_DATE = 9_007_199_254_740_991;

    public function index(Request $request): JsonResponse
    {
        return response()->json(['conversations' => $this->conversations()->list($this->owner($request), $this->scope($request))]);
    }

    public function show(Request $request, string $conversation): Response
    {
        $json = $this->conversations()->find($this->owner($request), $this->scope($request), $conversation);
        abort_if($json === null, 404);

        return response($json, 200, ['Content-Type' => 'application/json']);
    }

    public function store(Request $request, string $conversation): Response
    {
        $owner = $this->owner($request);
        $json = $request->getContent();

        $limit = config('aparte.conversations.max_bytes');
        abort_if(strlen($json) > (is_int($limit) && $limit > 0 ? $limit : 2 * 1024 * 1024), 413, 'This conversation is too large to keep.');

        // Decoded to objects, never to arrays: `{}` and `[]` must come back as they were sent.
        $data = json_decode($json);
        abort_unless($this->isConversation($data, $conversation), 422, 'This is not a conversation of the chat.');

        $this->conversations()->save($owner, $this->scope($request), $conversation, $json, $this->metaOf($data));

        return response()->noContent();
    }

    public function update(Request $request, string $conversation): Response
    {
        $owner = $this->owner($request);
        $body = $request->getContent();

        // The one write that does not go through the weight of a conversation: it has its own.
        abort_if(strlen($body) > self::CHANGE_BYTES, 413, 'This change is too large.');
        $changes = json_decode($body);
        abort_unless($this->isChange($changes), 422, 'A change is a title, a pin or an archive date.');

        $changed = $this->conversations()->change($owner, $this->scope($request), $conversation, function (string $json) use ($changes): array {
            $data = json_decode($json);

            foreach (get_object_vars($changes) as $field => $value) {
                if ($value === null) {
                    unset($data->{$field});
                } else {
                    $data->{$field} = is_string($value) ? mb_substr($value, 0, self::TITLE_LENGTH) : (int) $value;
                }
            }
            // A title someone typed is theirs: the chat no longer re-titles it from the first message.
            if (property_exists($changes, 'title')) {
                $data->autoTitle = false;
            }

            return [$this->encode($data), $this->metaOf($data)];
        });
        abort_unless($changed, 404);

        return response()->noContent();
    }

    public function destroy(Request $request, string $conversation): Response
    {
        $owner = $this->owner($request);

        // The model's memory goes with a conversation this list kept, and with no other: what
        // else the app has the model remember for this person is not the chat's to forget.
        if ($this->conversations()->delete($owner, $this->scope($request), $conversation)) {
            $this->forgetMemory($owner, $conversation);
        }

        return response()->noContent();
    }

    /**
     * Resolved for each request, not kept: under Octane a controller outlives the request, and a
     * repository of the app's own may be made for one person or one tenant.
     */
    private function conversations(): ConversationRepository
    {
        return app(ConversationRepository::class);
    }

    /** Conversations belong to someone: a guest's stay in the browser. */
    private function owner(Request $request): Authenticatable
    {
        $user = $request->user();
        abort_unless($user instanceof Authenticatable, 401);

        return $user;
    }

    /** The list these routes keep, as `Route::aparteConversations()` named it. */
    private function scope(Request $request): string
    {
        $scope = $request->route('scope');

        return is_string($scope) && $scope !== '' ? $scope : 'default';
    }

    private function isConversation(mixed $data, string $id): bool
    {
        return $data instanceof stdClass
            && ($data->id ?? null) === $id
            && is_array($data->messages ?? null)
            && is_string($data->title ?? '')
            && $this->isDate($data->createdAt ?? null)
            && $this->isDate($data->updatedAt ?? null)
            && $this->isDateOrAbsent($data->pinnedAt ?? null)
            && $this->isDateOrAbsent($data->archivedAt ?? null)
            && $this->isVersionOrAbsent($data->schemaVersion ?? null);
    }

    private function isChange(mixed $changes): bool
    {
        if (! $changes instanceof stdClass) {
            return false;
        }

        $fields = get_object_vars($changes);
        if ($fields === [] || array_diff(array_keys($fields), self::CHANGES) !== []) {
            return false;
        }

        foreach ($fields as $field => $value) {
            if ($field === 'title' ? ! is_string($value) : ! $this->isDateOrAbsent($value)) {
                return false;
            }
        }

        return true;
    }

    /**
     * A date as the chat writes one: milliseconds, a whole number a column can hold. Anything
     * else would reach the database as an error, or as another number than the one sent.
     */
    private function isDate(mixed $value): bool
    {
        return (is_int($value) || (is_float($value) && floor($value) === $value))
            && $value >= 0
            && $value <= self::LATEST_DATE;
    }

    private function isDateOrAbsent(mixed $value): bool
    {
        return $value === null || $this->isDate($value);
    }

    /** The chat's own version of what it saves: small, and kept in a small column. */
    private function isVersionOrAbsent(mixed $value): bool
    {
        return $value === null || (is_int($value) && $value >= 0 && $value <= 32_767);
    }

    /**
     * What the list shows of a conversation.
     *
     * @return array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}
     */
    private function metaOf(stdClass $data): array
    {
        $number = fn (string $field): ?int => isset($data->{$field}) ? (int) $data->{$field} : null;
        // A title is one line of text: what a database refuses in one (a NUL byte, on Postgres)
        // is a space in the list, and what is kept of the conversation keeps it as it was sent.
        $title = trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string) ($data->title ?? '')));

        return [
            'title' => mb_substr($title, 0, self::TITLE_LENGTH),
            'createdAt' => (int) $data->createdAt,
            'updatedAt' => (int) $data->updatedAt,
            'pinnedAt' => $number('pinnedAt'),
            'archivedAt' => $number('archivedAt'),
            'schemaVersion' => $number('schemaVersion'),
        ];
    }

    /** The conversation as JSON again, numbers written as PHP read them whatever the host's precision. */
    private function encode(stdClass $data): string
    {
        $precision = ini_set('serialize_precision', '-1');
        try {
            return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
        } finally {
            if ($precision !== false) {
                ini_set('serialize_precision', $precision);
            }
        }
    }

    /** The model's memory of that conversation, when the Laravel AI SDK keeps one for this person. */
    private function forgetMemory(Authenticatable $owner, string $id): void
    {
        $memory = new Conversation;
        // No such table: the SDK does not answer this app's chat, and there is nothing to forget.
        // Asked, not found out from a failed query, which would hide a real failure too.
        if (! $owner instanceof Model || ! $memory->getConnection()->getSchemaBuilder()->hasTable($memory->getTable())) {
            return;
        }

        $memory->getConnection()->transaction(function () use ($owner, $id): void {
            // Under the key the SDK knows the person by: the model's, as the chat's route gives it.
            $kept = Conversation::query()
                ->whereKey($id)
                ->where('participant_type', $owner->getMorphClass())
                ->where('participant_id', $owner->getKey())
                ->first();

            if ($kept !== null) {
                $kept->messages()->delete();
                $kept->delete();
            }
        });
    }
}
