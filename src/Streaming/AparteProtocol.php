<?php

namespace Aparte\Laravel\Streaming;

use Generator;
use Laravel\Ai\Exceptions\ApprovalMismatchException;
use Laravel\Ai\Streaming\Events\ToolApprovalRequest;
use Laravel\Ai\Streaming\Protocols\AgentUserInteractionProtocol;

class AparteProtocol extends AgentUserInteractionProtocol
{
    /**
     * The SDK sends "An error occurred." for any exception, APP_DEBUG or not, and reports it to
     * the log. With APP_DEBUG on, the browser gets the exception's class and message, as any
     * Laravel request that fails in debug mode shows its exception: the chat still reads its
     * sentence to the person, and the browser's console names the cause.
     */
    protected function maskedErrorParts(): Generator
    {
        if (! config('app.debug') || $this->finished || $this->exception === null || $this->exception instanceof ApprovalMismatchException) {
            yield from parent::maskedErrorParts();

            return;
        }

        yield from $this->yieldPart([
            'type' => 'RUN_ERROR',
            'message' => get_class($this->exception).': '.$this->exception->getMessage(),
        ]);
    }

    /**
     * The SDK names its approval interrupts `approval_required`. aparté's AG-UI runner
     * opens its approval panel on `tool_call`, the reason AG-UI agents commonly send.
     */
    protected function interrupts(ToolApprovalRequest $event): array
    {
        return array_map(
            fn (array $interrupt): array => ['reason' => 'tool_call'] + $interrupt,
            parent::interrupts($event),
        );
    }

    /**
     * The SDK ends a run with the ids of the messages it stored. AG-UI 1.0 describes no such
     * field on RUN_FINISHED, and aparté's runner drops each with a warning in the browser's
     * console: two per reply, about something the chat does not read.
     */
    protected function runFinishedPart(array $attributes = []): array
    {
        $part = parent::runFinishedPart($attributes);
        unset($part['messageId'], $part['userMessageId']);

        return $part;
    }
}
