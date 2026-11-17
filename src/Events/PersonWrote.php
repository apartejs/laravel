<?php

namespace Aparte\Laravel\Events;

/**
 * The person wrote in a conversation someone of your team holds (People::heldBy): no assistant
 * answers it, so this is how your desk hears it. The message is already in the agent's memory.
 */
class PersonWrote
{
    public function __construct(
        public readonly string $conversationId,
        public readonly string $messageId,
        public readonly string $text,
    ) {}
}
