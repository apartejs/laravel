<?php

namespace Aparte\Laravel\Tools;

use Aparte\Laravel\People;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

/**
 * Give it to your agent (`tools()`) and the assistant can hand a conversation to your team:
 * when the person asks for someone, or when it cannot help. The chat says someone will answer,
 * the assistant goes quiet, and SomeoneWanted tells your desk why.
 */
class AskForSomeone implements Tool
{
    /**
     * @param  string|null  $when  when to hand over, in your words; the default covers asking for a person and not knowing
     * @param  string|null  $notice  the line the chat draws (People::want)
     */
    public function __construct(
        private readonly ?string $when = null,
        private readonly ?string $notice = null,
    ) {}

    public function description(): Stringable|string
    {
        return 'Hand this conversation to a person of the team. '
            .($this->when ?? 'Use it when the user asks to talk to a person, or when you cannot answer or do what they ask.')
            .' After calling it, tell the user in one short sentence that someone of the team will answer here, and stop.';
    }

    public function handle(Request $request): Stringable|string
    {
        $conversationId = People::answering();
        if ($conversationId === null) {
            return 'No conversation to hand over.';
        }

        People::want($conversationId, (string) ($request['reason'] ?? ''), $this->notice);

        return 'The team was told and will answer here.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'reason' => $schema->string()->description('Why a person is needed, in a few words, for the team.')->required(),
        ];
    }
}
