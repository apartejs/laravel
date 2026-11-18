<?php

namespace Aparte\Laravel\Events;

/**
 * The person left an e-mail address in a conversation that waits for your team, to get the answer
 * there too (the chat's field, `:people-email="true"`). Your desk keeps it and writes to it.
 */
class VisitorLeftEmail
{
    public function __construct(
        public readonly string $conversationId,
        public readonly string $email,
    ) {}
}
