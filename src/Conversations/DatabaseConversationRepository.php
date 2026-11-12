<?php

namespace Aparte\Laravel\Conversations;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/** The conversations in a table of the app's database (`aparte.conversations.table`). */
class DatabaseConversationRepository implements ConversationRepository
{
    public function list(Authenticatable $owner): array
    {
        return $this->of($owner)
            ->orderByDesc('updated_ms')
            ->orderByDesc('id')
            ->limit((int) config('aparte.conversations.list', 200))
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

    public function find(Authenticatable $owner, string $id): ?string
    {
        return $this->of($owner)->where('conversation_id', $id)->value('payload');
    }

    public function save(Authenticatable $owner, string $id, string $json, array $meta): void
    {
        $this->table()->updateOrInsert($this->key($owner) + ['conversation_id' => $id], [
            'title' => $meta['title'],
            'created_ms' => $meta['createdAt'],
            'updated_ms' => $meta['updatedAt'],
            'pinned_ms' => $meta['pinnedAt'],
            'archived_ms' => $meta['archivedAt'],
            'schema_version' => $meta['schemaVersion'],
            'payload' => $json,
        ]);
    }

    public function delete(Authenticatable $owner, string $id): void
    {
        $this->of($owner)->where('conversation_id', $id)->delete();
    }

    private function table(): Builder
    {
        return DB::table(config('aparte.conversations.table', 'aparte_conversations'));
    }

    private function of(Authenticatable $owner): Builder
    {
        return $this->table()->where($this->key($owner));
    }

    /** @return array{owner_type: string, owner_id: string} */
    private function key(Authenticatable $owner): array
    {
        return [
            'owner_type' => method_exists($owner, 'getMorphClass') ? $owner->getMorphClass() : $owner::class,
            'owner_id' => (string) $owner->getAuthIdentifier(),
        ];
    }
}
