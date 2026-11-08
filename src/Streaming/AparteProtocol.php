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
}
