<?php

namespace Aparte\Laravel\Events;

/**
 * The person said how the conversation went, when your team asked (People::askRating, the chat's
 * question with `:people-rating="true"`): `up` or `down`. Your desk keeps it for its statistics.
 */
class VisitorRated
{
    public function __construct(
        public readonly string $conversationId,
        public readonly string $value,
    ) {}
}
