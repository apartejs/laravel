<?php

namespace Aparte\Laravel\Tests\Fixtures;

use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Messages\UserMessage;
use Laravel\Ai\Promptable;

/** An agent that notes what it remembers each time the model is called: the context the model is given. */
class MemoryAgent implements Agent, Conversational
{
    use Promptable, RemembersConversations {
        messages as remembered;
    }

    /**
     * One entry per call: each message as its role and its text, and the number of its files when it has some.
     *
     * @var list<list<array{0: string, 1: string, 2?: int}>>
     */
    public static array $seen = [];

    public function instructions(): string
    {
        return 'You are a test agent that shows what it remembers.';
    }

    public function messages(): iterable
    {
        $messages = [...$this->remembered()];
        static::$seen[] = array_map(function ($message): array {
            $seen = [is_object($message->role) ? $message->role->value : (string) $message->role, (string) ($message->content ?? '')];

            return $message instanceof UserMessage && $message->attachments->isNotEmpty() ? [...$seen, $message->attachments->count()] : $seen;
        }, $messages);

        return $messages;
    }
}
