<?php

use Aparte\Laravel\Streaming\AparteProtocol;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Exceptions;
use Laravel\Ai\Approvals\PendingApproval;
use Laravel\Ai\Exceptions\ApprovalMismatchException;
use Laravel\Ai\Exceptions\InsufficientCreditsException;
use Laravel\Ai\Exceptions\ProviderConnectionException;
use Laravel\Ai\Exceptions\ProviderOverloadedException;
use Laravel\Ai\Exceptions\RateLimitedException;
use Laravel\Ai\Streaming\Events\ToolApprovalRequest;
use Symfony\Component\HttpKernel\Exception\HttpException;

afterEach(fn () => AparteProtocol::describeErrorsUsing(null));

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

it("names what failed with one of aparté's codes, and keeps the message to the log", function (Throwable $exception, string $code) {
    // The chat says that code's sentence, in the reader's language: a rate limit reads as one,
    // not as "try again in a moment" like any other failure.
    config(['app.debug' => false]);

    expect(errorParts($exception))->toBe([['type' => 'RUN_ERROR', 'message' => 'An error occurred.', 'code' => $code]]);
})->with([
    "a provider's rate limit" => [RateLimitedException::forProvider('openai'), 'USAGE_RATE_LIMIT'],
    "Laravel's throttle" => [new ThrottleRequestsException('Too Many Attempts.'), 'USAGE_RATE_LIMIT'],
    'abort(429)' => [new HttpException(429), 'USAGE_RATE_LIMIT'],
    'a refused authorization' => [new AuthorizationException('This action is unauthorized.'), 'CONFIG_INVALID_KEY'],
    'a session that ended' => [new AuthenticationException('Unauthenticated.'), 'CONFIG_INVALID_KEY'],
    'abort(403)' => [new HttpException(403), 'CONFIG_INVALID_KEY'],
    'no credits left at the provider' => [InsufficientCreditsException::forProvider('openai'), 'PROVIDER_MISCONFIGURED'],
    'an overloaded provider' => [ProviderOverloadedException::forProvider('anthropic'), 'PROVIDER_UNAVAILABLE'],
    'abort(503)' => [new HttpException(503), 'PROVIDER_UNAVAILABLE'],
    'a provider out of reach' => [ProviderConnectionException::forProvider('openai'), 'NET_ERROR'],
]);

it('sends no code for a failure it cannot name', function (Throwable $exception) {
    config(['app.debug' => false]);

    expect(errorParts($exception))->toBe([['type' => 'RUN_ERROR', 'message' => 'An error occurred.']]);
})->with([
    'any exception' => [new RuntimeException('No API key for [openai].')],
    'abort(404)' => [new HttpException(404)],
]);

it('names the exception and its code together in debug mode', function () {
    config(['app.debug' => true]);

    expect(errorParts(RateLimitedException::forProvider('openai')))->toBe([[
        'type' => 'RUN_ERROR',
        'message' => RateLimitedException::class.': '.RateLimitedException::forProvider('openai')->getMessage(),
        'code' => 'USAGE_RATE_LIMIT',
    ]]);
});

it('lets the app say what the browser learns of a failure', function () {
    config(['app.debug' => false]);
    $seen = null;
    AparteProtocol::describeErrorsUsing(function (Throwable $exception, Request $request, array $default) use (&$seen) {
        $seen = [$exception->getMessage(), $default];

        return ['message' => 'Daily quota reached.', 'code' => 'USAGE_RATE_LIMIT'];
    });

    expect(errorParts(new RuntimeException('Quota of user 42.')))
        ->toBe([['type' => 'RUN_ERROR', 'message' => 'Daily quota reached.', 'code' => 'USAGE_RATE_LIMIT']])
        ->and($seen)->toBe(['Quota of user 42.', ['message' => 'An error occurred.']]);
});

it("keeps what the app leaves out of its answer, and drops a code it sets to null", function () {
    config(['app.debug' => false]);

    AparteProtocol::describeErrorsUsing(fn (Throwable $e) => ['message' => get_class($e).': '.$e->getMessage()]);
    expect(errorParts(RateLimitedException::forProvider('openai'))[0])
        ->toHaveKey('code', 'USAGE_RATE_LIMIT')
        ->message->toStartWith(RateLimitedException::class.': ');

    AparteProtocol::describeErrorsUsing(fn () => ['code' => null]);
    expect(errorParts(RateLimitedException::forProvider('openai')))->toBe([['type' => 'RUN_ERROR', 'message' => 'An error occurred.']]);
});

it("sends the package's own answer when the app returns null, or something it cannot send", function (mixed $answer) {
    config(['app.debug' => false]);
    AparteProtocol::describeErrorsUsing(fn () => $answer);

    expect(errorParts(RateLimitedException::forProvider('openai')))
        ->toBe([['type' => 'RUN_ERROR', 'message' => 'An error occurred.', 'code' => 'USAGE_RATE_LIMIT']]);
})->with([
    'null' => [null],
    'an empty message' => [['message' => '']],
    'a message that is not text' => [['message' => ['no']]],
    'a code that is not text' => [['code' => 429]],
]);

it("reports an app's description that throws, and sends the package's own", function () {
    config(['app.debug' => false]);
    Exceptions::fake();
    AparteProtocol::describeErrorsUsing(fn () => throw new LogicException('A bug in the description.'));

    expect(errorParts(new RuntimeException('The real failure.')))->toBe([['type' => 'RUN_ERROR', 'message' => 'An error occurred.']]);
    Exceptions::assertReported(fn (LogicException $e) => $e->getMessage() === 'A bug in the description.');
});

it("leaves the SDK's answer to an approval mismatch to the SDK, whatever the app says", function () {
    AparteProtocol::describeErrorsUsing(fn () => ['message' => 'Not this one.']);

    expect(errorParts(new ApprovalMismatchException('The approvals do not match.', collect())))
        ->toBe([['type' => 'RUN_ERROR', 'message' => 'The approvals do not match.', 'code' => 'approval_mismatch']]);
});
