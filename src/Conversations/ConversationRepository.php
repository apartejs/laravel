<?php

namespace Aparte\Laravel\Conversations;

use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Where the conversations a chat shows are kept. The routes of `Route::aparteConversations()`
 * talk to this, never to a table: bind your own class to keep them somewhere else.
 *
 * Every method is given the person the request belongs to, and answers for that person only.
 * The id comes from the browser: it means nothing outside its owner.
 */
interface ConversationRepository
{
    /**
     * The owner's conversations without their messages, the most recent first.
     *
     * @return list<array{id: string, title: string, createdAt: int, updatedAt: int, pinnedAt?: int, archivedAt?: int, schemaVersion?: int}>
     */
    public function list(Authenticatable $owner): array;

    /** One conversation as the chat saved it, its JSON untouched; null when the owner has none by that id. */
    public function find(Authenticatable $owner, string $id): ?string;

    /**
     * Keep a conversation, in place of the one the owner had by that id.
     *
     * @param  string  $json  the conversation as the chat sent it
     * @param  array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}  $meta  what the list shows of it
     */
    public function save(Authenticatable $owner, string $id, string $json, array $meta): void;

    /** Forget a conversation. One the owner does not have is not an error. */
    public function delete(Authenticatable $owner, string $id): void;
}
