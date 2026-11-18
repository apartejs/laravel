<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\Events\SomeoneWanted;
use Aparte\Laravel\People;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Messages\Message;

beforeEach(fn () => Event::fake([PersonWrote::class, SomeoneWanted::class, ConversationChanged::class]));

afterEach(function () {
    People::teamFirst(null);
    People::answering(null);
});

/** The first message of a guest's conversation, as the chat sends it. */
function firstMessage(string $text = 'Where is my order?', string $thread = 'thread-new'): array
{
    return ['threadId' => $thread, 'runId' => 'run-1', 'messages' => [['id' => 'm1', 'role' => 'user', 'content' => $text]]];
}

it('gives a new conversation to the team first while the app says it is there', function () {
    TestAgent::fake(['The assistant would have said this.']);
    People::teamFirst(fn (string $conversationId) => $conversationId === 'thread-new');

    $content = $this->postJson('/chat', firstMessage())->assertOk()->streamedContent();

    expect($content)->not->toContain('TEXT_MESSAGE')
        ->and(People::wanted('thread-new'))->toBe('Where is my order?');
    TestAgent::assertNeverPrompted();
    Event::assertDispatched(SomeoneWanted::class, fn (SomeoneWanted $e) => $e->conversationId === 'thread-new' && $e->source === 'team_first');
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->messageId === 'm1');

    // The question is kept where the conversation's memory is, for the team and the assistant.
    $read = collect((new TestAgent)->continue('thread-new', as: null)->messages())->map(fn (Message $m) => $m->content)->all();
    expect($read)->toBe(['Where is my order?']);
});

it('lets the assistant answer while the team is away', function () {
    TestAgent::fake(['Your order left yesterday.']);
    People::teamFirst(fn () => false);

    $content = $this->postJson('/chat', firstMessage())->assertOk()->streamedContent();

    expect($content)->toContain('"TEXT_MESSAGE_CONTENT"')
        ->and(People::wanted('thread-new'))->toBeNull();
    TestAgent::assertPrompted('Where is my order?');
    Event::assertNotDispatched(SomeoneWanted::class);
});

it('decides at the first message only: a conversation the assistant began goes on with it', function () {
    TestAgent::fake(['First answer.', 'Second answer.']);
    People::teamFirst(fn () => false);
    $this->postJson('/chat', firstMessage('Hello'))->assertOk()->streamedContent();

    // The team comes in: the conversation already under way stays the assistant's.
    People::teamFirst(fn () => true);
    $content = $this->postJson('/chat', ['threadId' => 'thread-new', 'runId' => 'run-2', 'messages' => [['id' => 'm2', 'role' => 'user', 'content' => 'And then?']]])
        ->assertOk()->streamedContent();

    expect($content)->toContain('"TEXT_MESSAGE_CONTENT"')
        ->and(People::wanted('thread-new'))->toBeNull();
    TestAgent::assertPrompted('And then?');
});

it('lets the assistant answer when the app gives no rule', function () {
    TestAgent::fake(['Hello there.']);

    expect($this->postJson('/chat', firstMessage())->assertOk()->streamedContent())->toContain('"TEXT_MESSAGE_CONTENT"');
    TestAgent::assertPrompted('Where is my order?');
});
