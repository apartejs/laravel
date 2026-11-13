<?php

namespace Aparte\Laravel\Conversations;

use Closure;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Where the conversations a chat shows are kept. The routes of `Route::aparteConversations()`
 * talk to this, never to a table: bind your own class to keep them somewhere else.
 *
 * Every method is given the person the request belongs to and the scope of the routes it came
 * through (one list of conversations: a chat, or the chats that share one), and answers for
 * that person in that scope only. The id comes from the browser: it means nothing outside them.
 */
interface ConversationRepository
{
    /**
     * The owner's conversations without their messages: what is pinned, then the most recent.
     *
     * @return list<array{id: string, title: string, createdAt: int, updatedAt: int, pinnedAt?: int, archivedAt?: int, schemaVersion?: int}>
     */
    public function list(Authenticatable $owner, string $scope): array;

    /** One conversation as the chat saved it, its JSON untouched; null when the owner has none by that id. */
    public function find(Authenticatable $owner, string $scope, string $id): ?string;

    /**
     * Keep a conversation, in place of the one the owner had by that id.
     *
     * @param  string  $json  the conversation as the chat sent it
     * @param  array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}  $meta  what the list shows of it
     */
    public function save(Authenticatable $owner, string $scope, string $id, string $json, array $meta): void;

    /**
     * Change a kept conversation in one step: `$change` is given its JSON and returns the JSON
     * and the meta to keep in its place, and nothing else writes that conversation in between
     * (a reply being saved while its title is changed must not be lost to it). False when the
     * owner has none by that id.
     *
     * @param  Closure(string): array{0: string, 1: array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}}  $change
     */
    public function change(Authenticatable $owner, string $scope, string $id, Closure $change): bool;

    /** Forget a conversation, and say whether there was one. One the owner does not have is not an error. */
    public function delete(Authenticatable $owner, string $scope, string $id): bool;
}
