<?php

namespace Aparte\Laravel\Conversations;

/**
 * What the person sees of a conversation while the chat answers in it: the messages of the branch on screen, and
 * the message the answer is drawn in. aparte.js sends their ids with each request (`forwardedProps.aparte`), and
 * the model's memory follows them (ShownBranchStore): after a retry, an edit, or a branch the person went back to,
 * the turns they no longer see are not read. Ids come from the browser, and the text of the person's message asked
 * again: nothing it sends is written as the assistant's, and it can leave out only turns of its own conversation, as
 * the person can by editing.
 */
final class ShownBranch
{
    /** More than any conversation a person scrolls through: past it, the list is not read. */
    private const MOST = 10_000;

    public ?string $conversationId = null;

    /** @var array<string, true>|null The ids of the messages on screen; null when the request named none. */
    public ?array $shown = null;

    /** The id of the message the answer is drawn in, kept with the answer. */
    public ?string $reply = null;

    /** The id of the person's message this turn answers: a new one, or the one retried or edited. */
    public ?string $asked = null;

    /** That message's text as the person wrote it, files aside. */
    public ?string $text = null;

    public function follow(string $conversationId, mixed $sent): void
    {
        $this->conversationId = $conversationId;
        $this->shown = null;
        $this->reply = null;
        $this->asked = null;
        $this->text = null;

        if (! is_array($sent)) {
            return;
        }

        $ids = $sent['shown'] ?? null;
        if (is_array($ids) && array_is_list($ids) && count($ids) <= self::MOST) {
            $this->shown = array_fill_keys(array_filter($ids, self::isId(...)), true);
        }

        $this->reply = self::isId($sent['reply'] ?? null) ? $sent['reply'] : null;
        $this->asked = self::isId($sent['asked'] ?? null) ? $sent['asked'] : null;
        // A message that was only a picture has no text: Laravel's ConvertEmptyStringsToNull turns its '' into null.
        $this->text = $this->asked !== null && array_key_exists('text', $sent)
            ? (is_string($sent['text']) ? $sent['text'] : ($sent['text'] === null ? '' : null))
            : null;
    }

    private static function isId(mixed $id): bool
    {
        return is_string($id) && $id !== '' && strlen($id) <= 200;
    }
}
