<?php

namespace Aparte\Laravel\Events;

/**
 * A conversation went to your team (People::want): no assistant answers there until someone takes
 * it over or hands it back. Tell your team. `source` says how it came: `tool` (the assistant called
 * AskForSomeone), `button` (the visitor's Talk to a person), `message` (a chat with the team only:
 * the visitor's first message), or what your own code passes to People::want().
 */
class SomeoneWanted
{
    public function __construct(
        public readonly string $conversationId,
        public readonly string $reason,
        public readonly string $source = 'tool',
    ) {}
}
