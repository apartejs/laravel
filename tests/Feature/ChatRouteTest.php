<?php

use Aparte\Laravel\Streaming\AparteProtocol;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Exceptions;
use Laravel\Ai\Exceptions\RateLimitedException;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Prompts\AgentPrompt;

afterEach(fn () => AparteProtocol::describeErrorsUsing(null));

function runInput(array $overrides = []): array
{
    return array_merge([
        'threadId' => 'thread-1',
        'runId' => 'run-1',
        'messages' => [['id' => 'm1', 'role' => 'user', 'content' => 'Hello']],
    ], $overrides);
}

function refusing(array $entry): array
{
    return runInput(['messages' => [], 'resume' => [['interruptId' => 'call-1', ...$entry]]]);
}

function makeUser(int $id): User
{
    return (new User)->forceFill(['id' => $id]);
}

function conversationOf(?User $user): Conversation
{
    return Conversation::create([
        'id' => 'thread-1',
        'participant_type' => $user?->getMorphClass(),
        'participant_id' => $user?->getKey(),
        'title' => 'Theirs',
    ]);
}

it('streams the agent as AG-UI', function () {
    TestAgent::fake(['Hi there']);

    $content = $this->postJson('/chat', runInput())->assertOk()->streamedContent();

    expect($content)->toContain('"RUN_STARTED"')->toContain('thread-1')->toContain('"TEXT_MESSAGE_CONTENT"');
});

it('adopts the thread id as the conversation', function () {
    TestAgent::fake(['Hi']);

    $this->postJson('/chat', runInput())->assertOk()->streamedContent();

    expect(Conversation::find('thread-1'))->not->toBeNull();
});

it('says what an agent without memory is missing', function () {
    $this->withoutExceptionHandling();
    Illuminate\Support\Facades\Route::aparte('/stateless', Aparte\Laravel\Tests\Fixtures\StatelessAgent::class);

    $this->postJson('/stateless', runInput());
})->throws(LogicException::class, 'must use the RemembersConversations trait');

it('requires a usable thread id', function (array $input) {
    $this->postJson('/chat', runInput($input))->assertStatus(422);
})->with([
    'missing' => [['threadId' => '']],
    'too long for the column' => [['threadId' => str_repeat('a', 37)]],
]);

it("refuses someone else's conversation", function () {
    conversationOf(makeUser(1));

    $this->actingAs(makeUser(2))->postJson('/chat', runInput())->assertForbidden();
});

it("refuses a signed-in user's conversation to a guest", function () {
    conversationOf(makeUser(1));

    $this->postJson('/chat', runInput())->assertForbidden();
});

it('continues the conversation of its owner', function () {
    TestAgent::fake(['Hi']);
    conversationOf(makeUser(1));

    $this->actingAs(makeUser(1))->postJson('/chat', runInput())->assertOk()->streamedContent();

    TestAgent::assertPrompted('Hello');
});

// What a chat with `files` sends: the image as an AG-UI content part (@aparte/runner-ag-ui), read by the SDK
// into an attachment of the prompt. Nothing of the package's own sits between them, and this proves it stays so.
it('hands the agent an image the person attached', function () {
    TestAgent::fake(['A red dot']);
    $dot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    $this->postJson('/chat', runInput(['messages' => [['id' => 'm1', 'role' => 'user', 'content' => [
        ['type' => 'text', 'text' => 'What is this?'],
        ['type' => 'image', 'source' => ['type' => 'data', 'value' => $dot, 'mimeType' => 'image/png']],
    ]]]]))->assertOk()->streamedContent();

    TestAgent::assertPrompted(fn (AgentPrompt $prompt) => $prompt->prompt === 'What is this?'
        && $prompt->attachments->count() === 1
        && $prompt->attachments->first() instanceof \Laravel\Ai\Files\Base64Image);
});

it('hands an approval to the SDK', function () {
    TestAgent::fake(['Done']);

    $this->postJson('/chat', refusing(['status' => 'resolved', 'payload' => ['approved' => true]]))
        ->assertOk()->streamedContent();

    TestAgent::assertPrompted(fn (AgentPrompt $prompt) => $prompt->approvalDecisions->get('call-1')->isRejected() === false);
});

it('gives a refusal a sentence, so the model is called again', function (array $entry, string $sentence) {
    TestAgent::fake(['Understood']);

    $this->postJson('/chat', refusing($entry))->assertOk()->streamedContent();

    TestAgent::assertPrompted(fn (AgentPrompt $prompt) => $prompt->approvalDecisions->get('call-1')->result === $sentence);
})->with([
    'a plain no' => [['status' => 'resolved', 'payload' => ['approved' => false]], 'The user refused this tool call.'],
    'a cancelled question' => [['status' => 'cancelled'], 'The user refused this tool call.'],
    'with an instruction' => [
        ['status' => 'resolved', 'payload' => ['approved' => false, 'instruction' => '  Use bread  ']],
        'The user refused this tool call and said: Use bread',
    ],
]);

it('caps what a refusal can carry', function () {
    TestAgent::fake(['Understood']);

    $this->postJson('/chat', refusing(['status' => 'resolved', 'payload' => ['approved' => false, 'instruction' => str_repeat('a', 5000)]]))
        ->assertOk()->streamedContent();

    TestAgent::assertPrompted(fn (AgentPrompt $prompt) => mb_strlen($prompt->approvalDecisions->get('call-1')->result) < 2100);
});

it('ends a run with only what AG-UI describes', function () {
    TestAgent::fake(['Hi']);

    $content = $this->actingAs(makeUser(1))->postJson('/chat', runInput())->assertOk()->streamedContent();
    $finished = collect(explode("\n", $content))->first(fn (string $line) => str_contains($line, '"RUN_FINISHED"'));

    // The SDK adds the ids of the messages it stored. AG-UI 1.0 has no such field on RUN_FINISHED,
    // and the chat's runner drops each with a warning in the browser's console: two per reply, for
    // nothing. `metadata` is AG-UI's own place for what it does not describe: they may stay there
    // (the SDK puts them there too since 1.4).
    expect($finished)->not->toBeNull();
    $event = json_decode(substr($finished, strlen('data: ')), true);

    expect($event)->toBeArray()
        ->and($event['type'])->toBe('RUN_FINISHED')
        ->and($event)->not->toHaveKey('messageId')
        ->and($event)->not->toHaveKey('userMessageId');
});

function runError(string $content): array
{
    $line = collect(explode("\n", $content))->first(fn (string $line) => str_contains($line, '"RUN_ERROR"'));
    expect($line)->not->toBeNull();

    return json_decode(substr($line, strlen('data: ')), true);
}

it('says what failed while the app is in debug mode', function () {
    // Laravel's own rule: with APP_DEBUG on, a request that fails shows its exception.
    config(['app.debug' => true]);
    Exceptions::fake();
    TestAgent::fake(fn () => throw new RuntimeException('No API key for [openai].'));

    $content = $this->postJson('/chat', runInput())->assertOk()->streamedContent();

    expect(runError($content)['message'])->toBe('RuntimeException: No API key for [openai].');
    Exceptions::assertReported(fn (RuntimeException $e) => $e->getMessage() === 'No API key for [openai].');
});

it('keeps what failed to the log outside debug mode', function () {
    // An exception's message can name a table, a path or a key: in production the browser reads
    // only that the run failed, and the log has the rest.
    config(['app.debug' => false]);
    Exceptions::fake();
    TestAgent::fake(fn () => throw new RuntimeException('No API key for [openai].'));

    $content = $this->postJson('/chat', runInput())->assertOk()->streamedContent();

    expect(runError($content)['message'])->toBe('An error occurred.')
        ->and($content)->not->toContain('No API key');
    Exceptions::assertReported(fn (RuntimeException $e) => $e->getMessage() === 'No API key for [openai].');
});

it("tells the browser a provider's rate limit by aparté's code, the message still masked", function () {
    config(['app.debug' => false]);
    Exceptions::fake();
    TestAgent::fake(fn () => throw RateLimitedException::forProvider('openai'));

    $content = $this->postJson('/chat', runInput())->assertOk()->streamedContent();

    expect(runError($content))->toMatchArray(['message' => 'An error occurred.', 'code' => 'USAGE_RATE_LIMIT']);
});

it('hands the request to the description, so the app can tell one person from another', function () {
    config(['app.debug' => false]);
    Exceptions::fake();
    AparteProtocol::describeErrorsUsing(fn (Throwable $e, Illuminate\Http\Request $request) => $request->user()?->getKey() === 1
        ? ['message' => get_class($e).': '.$e->getMessage()]
        : null);
    TestAgent::fake(fn () => throw new RuntimeException('No API key for [openai].'));

    $trusted = $this->actingAs(makeUser(1))->postJson('/chat', runInput())->assertOk()->streamedContent();
    $other = $this->actingAs(makeUser(2))->postJson('/chat', runInput(['threadId' => 'thread-2']))->assertOk()->streamedContent();

    expect(runError($trusted)['message'])->toBe('RuntimeException: No API key for [openai].')
        ->and(runError($other)['message'])->toBe('An error occurred.')
        ->and($other)->not->toContain('No API key');
});
