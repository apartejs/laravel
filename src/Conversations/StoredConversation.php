<?php

namespace Aparte\Laravel\Conversations;

use stdClass;

/**
 * A conversation as aparté's manager stores it, read and written the way the chat reads it:
 * its `messages` (the active path) and, when it has one, its branch `tree`
 * (`{ headId, messages: [{ message, parentId }] }`), which is what a reopened conversation shows.
 */
final class StoredConversation
{
    public const TITLE_LENGTH = 255;

    /**
     * The conversation with a message added at the end of its active path, in `messages` and in
     * `tree`, as `AparteConversationManager::addMessage()` adds one. A message already there is
     * not added twice.
     *
     * @param  array<string, mixed>  $message
     * @return array{0: string, 1: array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}}
     */
    public static function withMessage(string $json, array $message): array
    {
        $data = json_decode($json);
        $added = json_decode(json_encode($message, JSON_THROW_ON_ERROR));
        $id = $added->id;

        $messages = is_array($data->messages ?? null) ? $data->messages : [];
        if (! self::holds($messages, $id)) {
            $messages[] = $added;
        }
        $data->messages = $messages;

        if (($data->tree ?? null) instanceof stdClass && is_array($data->tree->messages ?? null)
            && ! self::holds(array_map(fn ($node) => $node->message ?? null, $data->tree->messages), $id)) {
            $data->tree->messages[] = (object) ['message' => $added, 'parentId' => $data->tree->headId ?? null];
            $data->tree->headId = $id;
        }

        $data->updatedAt = self::now();

        return [self::encode($data), self::meta($data)];
    }

    /**
     * The conversation with fields of one message changed (`['note' => 'Read by Marie']`),
     * in `messages` and in `tree`. A field set to null is taken away.
     *
     * @param  array<string, mixed>  $changes
     * @return array{0: string, 1: array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}}
     */
    public static function withChange(string $json, string $messageId, array $changes): array
    {
        $data = json_decode($json);
        $apply = function (mixed $message) use ($messageId, $changes): void {
            if (! $message instanceof stdClass || ($message->id ?? null) !== $messageId) {
                return;
            }
            foreach ($changes as $field => $value) {
                if ($value === null) {
                    unset($message->{$field});
                } else {
                    $message->{$field} = $value;
                }
            }
        };

        foreach (is_array($data->messages ?? null) ? $data->messages : [] as $message) {
            $apply($message);
        }
        foreach (($data->tree ?? null) instanceof stdClass && is_array($data->tree->messages ?? null) ? $data->tree->messages : [] as $node) {
            $apply($node->message ?? null);
        }

        $data->updatedAt = self::now();

        return [self::encode($data), self::meta($data)];
    }

    /**
     * What the list shows of a conversation, from its JSON.
     *
     * @return array{title: string, createdAt: int, updatedAt: int, pinnedAt: int|null, archivedAt: int|null, schemaVersion: int|null}
     */
    public static function meta(stdClass $data): array
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
    public static function encode(stdClass $data): string
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

    /** @param  array<int, mixed>  $messages */
    private static function holds(array $messages, string $id): bool
    {
        foreach ($messages as $message) {
            if ($message instanceof stdClass && ($message->id ?? null) === $id) {
                return true;
            }
        }

        return false;
    }

    private static function now(): int
    {
        return (int) floor(microtime(true) * 1000);
    }
}
