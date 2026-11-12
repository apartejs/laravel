<?php

namespace Aparte\Laravel\Http;

use Aparte\Laravel\Conversations\ConversationRepository;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Laravel\Ai\Models\Conversation;
use stdClass;

/**
 * The conversations a chat shows, kept for the person signed in: five routes on one address
 * (`Route::aparteConversations()`). What is kept is what the browser sent, as it sent it, and it
 * is only ever given back to the person it was kept for.
 */
class ConversationsController
{
    /** What a PATCH may change without the messages travelling. */
    private const CHANGES = ['title', 'pinnedAt', 'archivedAt'];

    public function __construct(private ConversationRepository $conversations) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['conversations' => $this->conversations->list($this->owner($request))]);
    }

    public function show(Request $request, string $conversation): Response
    {
        $json = $this->conversations->find($this->owner($request), $conversation);
        abort_if($json === null, 404);

        return $this->json($json);
    }

    public function store(Request $request, string $conversation): Response
    {
        $owner = $this->owner($request);
        $json = $request->getContent();

        abort_if(strlen($json) > (int) config('aparte.conversations.max_bytes', 2 * 1024 * 1024), 413, 'This conversation is too large to keep.');

        // Decoded to objects, never to arrays: `{}` and `[]` must come back as they were sent.
        $data = json_decode($json);
        abort_unless($this->isConversation($data, $conversation), 422, 'This is not a conversation of the chat.');

        $this->conversations->save($owner, $conversation, $json, $this->metaOf($data));

        return response()->noContent();
    }

    public function update(Request $request, string $conversation): Response
    {
        $owner = $this->owner($request);
        $changes = json_decode($request->getContent());

        abort_unless($this->isChange($changes), 422, 'A change is a title, a pin or an archive date.');

        $json = $this->conversations->find($owner, $conversation);
        abort_if($json === null, 404);
        $data = json_decode($json);

        foreach (get_object_vars($changes) as $field => $value) {
            if ($value === null) {
                unset($data->{$field});
            } else {
                $data->{$field} = is_string($value) ? $value : (int) $value;
            }
        }
        // A title someone typed is theirs: the chat no longer re-titles it from the first message.
        if (property_exists($changes, 'title')) {
            $data->autoTitle = false;
        }

        $this->conversations->save(
            $owner,
            $conversation,
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR),
            $this->metaOf($data),
        );

        return response()->noContent();
    }

    public function destroy(Request $request, string $conversation): Response
    {
        $owner = $this->owner($request);

        $this->conversations->delete($owner, $conversation);
        $this->forgetMemory($owner, $conversation);

        return response()->noContent();
    }

    /** Conversations belong to someone: a guest's stay in the browser. */
    private function owner(Request $request): Authenticatable
    {
        $user = $request->user();
        abort_unless($user instanceof Authenticatable, 401);

        return $user;
    }

    private function json(string $json): Response
    {
        return response($json, 200, ['Content-Type' => 'application/json']);
    }

    private function isConversation(mixed $data, string $id): bool
    {
        return $data instanceof stdClass
            && ($data->id ?? null) === $id
            && is_array($data->messages ?? null)
            && is_string($data->title ?? '')
            && $this->isDate($data->createdAt ?? null)
            && $this->isDate($data->updatedAt ?? null);
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
            if ($field === 'title' ? ! is_string($value) : ! ($value === null || $this->isDate($value))) {
                return false;
            }
        }

        return true;
    }

    /** A date as the chat writes one: milliseconds. */
    private function isDate(mixed $value): bool
    {
        return is_int($value) || is_float($value);
    }

    /**
     * What the list shows of a conversation.
     *
     * @return array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}
     */
    private function metaOf(stdClass $data): array
    {
        $date = fn (string $field): ?int => $this->isDate($data->{$field} ?? null) ? (int) $data->{$field} : null;

        return [
            'title' => mb_substr((string) ($data->title ?? ''), 0, 255),
            'createdAt' => (int) $data->createdAt,
            'updatedAt' => (int) $data->updatedAt,
            'pinnedAt' => $date('pinnedAt'),
            'archivedAt' => $date('archivedAt'),
            'schemaVersion' => $date('schemaVersion'),
        ];
    }

    /** The model's memory of that conversation, when the Laravel AI SDK keeps one for this person. */
    private function forgetMemory(Authenticatable $owner, string $id): void
    {
        try {
            $memory = Conversation::query()
                ->whereKey($id)
                ->where('participant_type', method_exists($owner, 'getMorphClass') ? $owner->getMorphClass() : $owner::class)
                ->where('participant_id', $owner->getAuthIdentifier())
                ->first();

            if ($memory !== null) {
                $memory->messages()->delete();
                $memory->delete();
            }
        } catch (QueryException) {
            // No such tables: the SDK does not answer this app's chat, and there is nothing to forget.
        }
    }
}
