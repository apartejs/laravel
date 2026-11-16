<?php

use Aparte\Laravel\Streaming\AparteProtocol;
use Laravel\Ai\Approvals\PendingApproval;
use Laravel\Ai\Exceptions\ApprovalMismatchException;
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

/** The parts the protocol ends a failed stream with, for a run already started. */
function errorParts(Throwable $exception, bool $finished = false): array
{
    $protocol = new AparteProtocol('thread-1', 'run-1');
    foreach (['started' => true, 'finished' => $finished, 'exception' => $exception] as $name => $value) {
        (new ReflectionProperty($protocol, $name))->setValue($protocol, $value);
    }

    return iterator_to_array((new ReflectionMethod($protocol, 'maskedErrorParts'))->invoke($protocol), false);
}

it('keeps the SDK\'s own answer to an approval mismatch in debug mode', function () {
    config(['app.debug' => true]);

    expect(errorParts(new ApprovalMismatchException('The approvals do not match.', collect())))
        ->toBe([['type' => 'RUN_ERROR', 'message' => 'The approvals do not match.', 'code' => 'approval_mismatch']]);
});

it('adds nothing after a run that an approval already ended, in debug mode', function () {
    config(['app.debug' => true]);

    expect(errorParts(new RuntimeException('Late.'), finished: true))->toBe([]);
});
