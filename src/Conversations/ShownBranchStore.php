<?php

namespace Aparte\Laravel\Conversations;

use Illuminate\Support\Collection;
use Laravel\Ai\Messages\UserMessage;
use Laravel\Ai\Enums\MessageStatus;
use Laravel\Ai\Prompts\AgentPrompt;
use Laravel\Ai\Responses\AgentResponse;
use Laravel\Ai\Storage\DatabaseConversationStore;
use Throwable;

/**
 * The Laravel AI SDK's own conversation store, with the model's memory following the branch the person sees
 * (ShownBranch). Each answer is kept with the id of its message in the chat (`meta.aparte.reply`), and nothing is
 * deleted: reading the memory for a turn leaves out the answers on a branch the chat no longer shows, with the
 * messages that asked them, and keeps everything else as the SDK stored it (pictures, files, tool calls, your team's
 * messages). For a request that names no branch (another runner, a page from before), the memory is the SDK's whole.
 */
class ShownBranchStore extends DatabaseConversationStore
{
    /** The SDK's store as it is bound, on its connection, with the memory following the branch. */
    public static function following(DatabaseConversationStore $store): static
    {
        return new static($store->connection);
    }

    public function storeUserMessage(string $conversationId, ?string $participantType, string|int|null $participantId, string $agent, UserMessage $message): string
    {
        $id = parent::storeUserMessage($conversationId, $participantType, $participantId, $agent, $message);

        // Which of the chat's messages it is, and its text as the person wrote it: what a retry or an edit of it asks
        // again (askedAgain).
        $branch = $this->branchOf($conversationId);
        if ($branch?->asked !== null) {
            $this->tag($id, ['asked' => $branch->asked, 'text' => $branch->text]);
        }

        return $id;
    }

    /**
     * The person's message a retry or an edit asks again, as the model first read it: its pictures, and the text
     * files read with it. The chat sends neither again (only the text, or nothing for a message that was only a
     * picture). A retry sends the text the message was sent with, and gets the message whole; an edit sends new text,
     * which takes the place of the old one before the files. Null for a message this conversation has not kept.
     */
    public function askedAgain(string $conversationId): ?UserMessage
    {
        $branch = $this->branchOf($conversationId);
        if ($branch?->asked === null || $branch->text === null) {
            return null;
        }

        foreach ($this->table($this->messagesTable())->where('conversation_id', $conversationId)->where('role', 'user')->orderBy('id')->cursor() as $record) {
            $tags = $this->tagsOf($record);
            if ($tags['asked'] !== $branch->asked) {
                continue;
            }

            $attachments = $this->rehydrateAttachments($record->attachments);
            if ($tags['text'] === $branch->text) {
                return new UserMessage($record->content, $attachments);
            }

            return new UserMessage(self::edited($record->content, $tags['text'], $branch->text), $attachments);
        }

        return null;
    }

    /**
     * A message as first sent, with the text the person wrote in it replaced. What surrounds that text stays: the
     * files read after it, and a message sent earlier without an answer, which the chat joins in front of the next.
     * Where the old text is, is where it ends the message or comes before a file (```); without it, the new text
     * comes after what was there.
     */
    private static function edited(string $content, ?string $was, string $now): string
    {
        if ($was === null || $was === '') {
            return $content === '' ? $now : $content."\n\n".$now;
        }

        $at = str_ends_with($content, $was) ? strlen($content) - strlen($was) : strrpos($content, $was.'```');
        $at = $at === false ? strpos($content, $was) : $at;

        return $at === false ? $content."\n\n".$now : substr_replace($content, $now, $at, strlen($was));
    }

    public function storeAssistantMessage(string $conversationId, ?string $participantType, string|int|null $participantId, AgentPrompt $prompt, AgentResponse $response, ?Throwable $exception = null): ?string
    {
        $id = parent::storeAssistantMessage($conversationId, $participantType, $participantId, $prompt, $response, $exception);

        $reply = $this->branchOf($conversationId)?->reply;
        if ($id !== null && $reply !== null) {
            $this->tag($id, ['reply' => $reply]);
        }

        return $id;
    }

    /** @param  array<string, string|null>  $tags  Kept under `meta.aparte`, beside the SDK's own meta. */
    private function tag(string $id, array $tags): void
    {
        $row = $this->table($this->messagesTable())->where('id', $id);
        $meta = $this->decoded($row->value('meta'));
        $meta['aparte'] = [...(is_array($meta['aparte'] ?? null) ? $meta['aparte'] : []), ...array_filter($tags, fn ($tag) => $tag !== null)];
        $row->update(['meta' => json_encode($meta)]);
    }

    public function getLatestConversationMessages(string $conversationId, int $limit): Collection
    {
        $shown = $this->branchOf($conversationId)?->shown;
        // The screen says nothing of what comes before the first message it shows that was kept here: a chat with one
        // thread, opened in a new tab, shows none of it. That part, and all of it when nothing kept is shown, is the
        // memory as the SDK kept it.
        $first = $shown === null ? null : $this->firstShown($conversationId, $shown);
        if ($first === null) {
            return parent::getLatestConversationMessages($conversationId, $limit);
        }

        // From the newest back: a person's message the chat sent goes with the answer after it, and one nothing
        // answers yet is kept; a message it did not send (written to your team) stays.
        $records = [];
        $answered = true;
        foreach ($this->table($this->messagesTable())->where('conversation_id', $conversationId)->orderByDesc('id')->cursor() as $record) {
            $before = strcmp((string) $record->id, $first) < 0;
            if ($record->role !== 'user') {
                $answered = $before || $this->isShown($record, $shown);
                $kept = $answered;
            } else {
                $kept = $before || $answered || $this->tagsOf($record)['asked'] === null;
            }
            if ($kept) {
                $records[] = $record;
            }
            if (count($records) >= $limit) {
                break;
            }
        }

        return collect(array_reverse($records))->flatMap(fn (object $record): array => $record->role === 'user'
            ? [$this->userMessageFrom($record)]
            : $this->assistantTurnFrom($record));
    }

    /**
     * The id of the oldest row the chat shows (an answer drawn in a message on screen, or a person's message on
     * screen), or null when it shows none.
     *
     * @param  array<string, true>  $shown
     */
    private function firstShown(string $conversationId, array $shown): ?string
    {
        foreach ($this->table($this->messagesTable())->where('conversation_id', $conversationId)->orderBy('id')->select(['id', 'meta'])->cursor() as $record) {
            $tags = $this->tagsOf($record);
            if (isset($shown[$tags['reply'] ?? '']) || isset($shown[$tags['asked'] ?? ''])) {
                return (string) $record->id;
            }
        }

        return null;
    }

    /** @return array{reply: ?string, asked: ?string, text: ?string} The chat's ids a row was kept with. */
    private function tagsOf(object $record): array
    {
        $kept = $this->decoded($record->meta)['aparte'] ?? null;
        $tag = fn (string $name): ?string => is_array($kept) && is_string($kept[$name] ?? null) ? $kept[$name] : null;

        return ['reply' => $tag('reply'), 'asked' => $tag('asked'), 'text' => $tag('text')];
    }

    /** @param  array<string, true>  $shown */
    protected function isShown(object $record, array $shown): bool
    {
        $reply = $this->tagsOf($record)['reply'];
        // Kept with no id of the chat's (written before, or by your team): it stays.
        if ($reply === null || isset($shown[$reply])) {
            return true;
        }

        // An answer that failed after its tools ran stays known whatever the chat shows, as the SDK keeps it so: a
        // retry finishes what it started, and must not do it twice. A finished answer the person retries is left out,
        // tools and all: they asked for another answer.
        return MessageStatus::tryFrom((string) $record->status) === MessageStatus::Failed
            && $this->decodedSteps($record)->contains(fn ($step) => ! empty($step['tool_calls'] ?? null));
    }

    private function branchOf(string $conversationId): ?ShownBranch
    {
        $branch = app(ShownBranch::class);

        return $branch->conversationId === $conversationId ? $branch : null;
    }
}
