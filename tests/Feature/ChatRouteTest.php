<?php

use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Illuminate\Foundation\Auth\User;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Prompts\AgentPrompt;

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
