<?php

namespace Aparte\Laravel\Events;

/**
 * The assistant handed a conversation to your team (People::want, the AskForSomeone tool): it no
 * longer answers there until someone takes it over or hands it back. Tell your team.
 */
class SomeoneWanted
{
    public function __construct(
        public readonly string $conversationId,
        public readonly string $reason,
    ) {}
}
