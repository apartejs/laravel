<?php

namespace Aparte\Laravel\Conversations;

use Closure;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/** The conversations in a table of the app's database (`aparte.conversations.table`). */
class DatabaseConversationRepository implements ConversationRepository
{
    public function list(Authenticatable $owner, string $scope): array
    {
        $limit = config('aparte.conversations.list');

        return $this->of($owner, $scope)
            // What is pinned first: the limit cuts the oldest, and a pin is what keeps one in reach.
            ->orderByRaw('case when pinned_ms is null then 1 else 0 end')
            ->orderByDesc('updated_ms')
            ->orderByDesc('id')
            ->limit(is_int($limit) && $limit > 0 ? $limit : 200)
            ->get(['conversation_id', 'title', 'created_ms', 'updated_ms', 'pinned_ms', 'archived_ms', 'schema_version'])
            ->map(fn (object $row): array => array_filter([
                'id' => $row->conversation_id,
                'title' => $row->title,
                'createdAt' => (int) $row->created_ms,
                'updatedAt' => (int) $row->updated_ms,
                'pinnedAt' => $row->pinned_ms === null ? null : (int) $row->pinned_ms,
                'archivedAt' => $row->archived_ms === null ? null : (int) $row->archived_ms,
                'schemaVersion' => $row->schema_version === null ? null : (int) $row->schema_version,
            ], fn (mixed $value): bool => $value !== null))
            ->all();
    }

    public function find(Authenticatable $owner, string $scope, string $id): ?string
    {
        return $this->of($owner, $scope)->where('conversation_id', $id)->value('payload');
    }

    public function save(Authenticatable $owner, string $scope, string $id, string $json, array $meta): void
    {
        // One statement: two saves of a new conversation arriving together are one row, not an error.
        $this->table()->upsert(
            [$this->key($owner, $scope) + ['conversation_id' => $id] + $this->columns($json, $meta)],
            ['owner_type', 'owner_id', 'scope', 'conversation_id'],
            ['title', 'created_ms', 'updated_ms', 'pinned_ms', 'archived_ms', 'schema_version', 'payload'],
        );
    }

    public function change(Authenticatable $owner, string $scope, string $id, Closure $change): bool
    {
        return DB::transaction(function () use ($owner, $scope, $id, $change): bool {
            // The row is held from the read to the write: a save arriving in between waits its turn.
            $json = $this->of($owner, $scope)->where('conversation_id', $id)->lockForUpdate()->value('payload');
            if ($json === null) {
                return false;
            }

            [$json, $meta] = $change($json);
            $this->of($owner, $scope)->where('conversation_id', $id)->update($this->columns($json, $meta));

            return true;
        });
    }

    public function delete(Authenticatable $owner, string $scope, string $id): bool
    {
        return $this->of($owner, $scope)->where('conversation_id', $id)->delete() > 0;
    }

    private function table(): Builder
    {
        return DB::table(config('aparte.conversations.table') ?: 'aparte_conversations');
    }

    private function of(Authenticatable $owner, string $scope): Builder
    {
        return $this->table()->where($this->key($owner, $scope));
    }

    /** @return array{owner_type: string, owner_id: string, scope: string} */
    private function key(Authenticatable $owner, string $scope): array
    {
        return [
            // A model says what kind of account it is. Anything else (the `database` user provider
            // gives every account the same class) is told apart by the guard it signed in on.
            'owner_type' => $owner instanceof Model ? $owner->getMorphClass() : 'guard:'.Auth::getDefaultDriver(),
            'owner_id' => (string) $owner->getAuthIdentifier(),
            'scope' => $scope,
        ];
    }

    /**
     * @param  array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}  $meta
     * @return array<string, mixed>
     */
    private function columns(string $json, array $meta): array
    {
        return [
            'title' => $meta['title'],
            'created_ms' => $meta['createdAt'],
            'updated_ms' => $meta['updatedAt'],
            'pinned_ms' => $meta['pinnedAt'],
            'archived_ms' => $meta['archivedAt'],
            'schema_version' => $meta['schemaVersion'],
            'payload' => $json,
        ];
    }
}
