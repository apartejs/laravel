<?php

namespace Aparte\Laravel\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Something the chat must show at once, sent on the conversation's private channel
 * (`aparte.conversations.{id}`, as `aparte.changed`): a message, a note under a message, or the
 * assistant turned off or on. Authorize the channel in your `routes/channels.php`.
 */
class ConversationChanged implements ShouldBroadcastNow
{
    /**
     * @param  array<string, mixed>  $change  `['type' => 'message', 'message' => [...]]`,
     *                                        `['type' => 'note', 'messageId' => '…', 'note' => '…']`
     *                                        or `['type' => 'auto-reply', 'on' => bool]`
     */
    public function __construct(
        public readonly string $conversationId,
        public readonly array $change,
    ) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('aparte.conversations.'.$this->conversationId)];
    }

    public function broadcastAs(): string
    {
        return 'aparte.changed';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return $this->change;
    }
}
