<?php

namespace Aparte\Laravel\Streaming;

use Laravel\Ai\Streaming\Events\ToolApprovalRequest;
use Laravel\Ai\Streaming\Protocols\AgentUserInteractionProtocol;

class AparteProtocol extends AgentUserInteractionProtocol
{
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
