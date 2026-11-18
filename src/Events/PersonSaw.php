<?php

namespace Aparte\Laravel\Events;

/**
 * The person has seen what your team wrote in a conversation: the chat was open on it, in a tab
 * in front of them. Your desk can show "Seen" under your team's last message.
 */
class PersonSaw
{
    public function __construct(
        public readonly string $conversationId,
    ) {}
}
