<?php

namespace Aparte\Laravel\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Something the chat must show at once, sent as `aparte.changed` on the conversation's channel
 * (People::channel): a message, a note under a message, or the assistant turned off or on. A
 * signed-in person's is private, `aparte.conversations.{id}`: authorize it in your
 * `routes/channels.php` with People::owns. A guest's is public, under a name only their browser
 * is given.
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
        public readonly ?array $channel = null,
    ) {}

    /** @return list<Channel> */
    public function broadcastOn(): array
    {
        $channel = $this->channel ?? ['name' => 'aparte.conversations.'.$this->conversationId, 'private' => true];

        return [$channel['private'] ? new PrivateChannel($channel['name']) : new Channel($channel['name'])];
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
