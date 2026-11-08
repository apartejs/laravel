<?php

use Aparte\Laravel\Streaming\AparteProtocol;
use Laravel\Ai\Approvals\PendingApproval;
use Laravel\Ai\Streaming\Events\ToolApprovalRequest;

it('names an approval the way the runner reads it', function () {
    $protocol = new AparteProtocol('thread-1', 'run-1');
    $event = new ToolApprovalRequest('event-1', collect([new PendingApproval('call-1', 'add_task', ['title' => 'Milk'], 'Why')]), time());

    $interrupts = (new ReflectionMethod($protocol, 'interrupts'))->invoke($protocol, $event);

    expect($interrupts[0])
        ->reason->toBe('tool_call')
        ->toolCallId->toBe('call-1')
        ->message->toBe('Why');
});
