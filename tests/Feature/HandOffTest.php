<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\Events\SomeoneWanted;
use Aparte\Laravel\People;
use Aparte\Laravel\Tools\AskForSomeone;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Tools\Request;
use Aparte\Laravel\Tests\Fixtures\TestAgent;

afterEach(fn () => People::answering(null));

it('hands a conversation to the team from the tool: quiet, a notice, and why', function () {
    Event::fake([SomeoneWanted::class, ConversationChanged::class]);
    $user = peopleUser(1);
    heldConversation($user);
    People::answering('thread-1');

    $said = (new AskForSomeone)->handle(new Request(['reason' => 'change a delivery address']));

    expect((string) $said)->toContain('team')
        ->and(People::wanted('thread-1'))->toBe('change a delivery address');
    Event::assertDispatched(SomeoneWanted::class, fn (SomeoneWanted $e) => $e->conversationId === 'thread-1' && $e->reason === 'change a delivery address');
    $types = Event::dispatched(ConversationChanged::class)->map(fn ($e) => $e[0]->change['type'] ?? null)->all();
    expect($types)->toContain('auto-reply')->toContain('message');
});

it('describes itself to the model, with the reason it needs', function () {
    $tool = new AskForSomeone(when: 'Use it for refunds.');

    expect((string) $tool->description())->toContain('Use it for refunds.')
        ->and(array_keys($tool->schema(new JsonSchemaTypeFactory)))->toBe(['reason']);
});

it('does not run the agent while the conversation waits for someone, and keeps the message', function () {
    Event::fake([PersonWrote::class, SomeoneWanted::class, ConversationChanged::class]);
    TestAgent::fake(['The assistant would have said this.']);
    $user = peopleUser(1);
    heldConversation($user);
    People::want('thread-1', 'asked for a person');

    $content = $this->actingAs($user)->postJson('/chat', [
        'threadId' => 'thread-1',
        'runId' => 'run-1',
        'messages' => [['id' => 'm1', 'role' => 'user', 'content' => 'Hello?']],
    ])->assertOk()->streamedContent();

    expect($content)->not->toContain('TEXT_MESSAGE');
    TestAgent::assertNeverPrompted();
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->messageId === 'm1');
});

it('stops waiting when someone takes it over or hands it back', function () {
    Event::fake([SomeoneWanted::class, ConversationChanged::class]);
    heldConversation(peopleUser(1));

    People::want('thread-1', 'asked for a person');
    People::takeOver('thread-1', ['name' => 'Marie']);
    expect(People::wanted('thread-1'))->toBeNull();

    People::want('thread-1', 'asked again');
    People::handBack('thread-1');
    expect(People::wanted('thread-1'))->toBeNull();
});

it("asks for someone of the team from the visitor's button, without the model", function () {
    Event::fake([SomeoneWanted::class, ConversationChanged::class]);

    // A guest's conversation the chat has not written yet: the button may come before any message.
    $notice = $this->postJson('/chat/people/new-1/want')->assertOk()->json('notice');

    expect($notice['kind'])->toBe('notice')
        ->and($notice['content'])->toBe('Someone of the team will answer you here')
        ->and(People::wanted('new-1'))->toBe('The visitor asked for a person');
    Event::assertDispatched(SomeoneWanted::class, fn (SomeoneWanted $e) => $e->conversationId === 'new-1');
    expect($this->getJson('/chat/people/new-1')->json('wanted'))->toBeTrue();
});

it('changes nothing when someone holds the conversation or it already waits', function () {
    Event::fake([SomeoneWanted::class, ConversationChanged::class]);
    heldConversation(peopleUser(1));
    People::heldBy(fn () => ['name' => 'Marie']);

    expect($this->actingAs(peopleUser(1))->postJson('/chat/people/thread-1/want')->assertOk()->json('notice'))->toBeNull();
    People::heldBy(null);

    People::want('thread-1', 'asked before');
    expect($this->actingAs(peopleUser(1))->postJson('/chat/people/thread-1/want')->json('notice'))->toBeNull()
        ->and(People::wanted('thread-1'))->toBe('asked before');
});

it("refuses to ask for someone in another person's conversation", function () {
    heldConversation(peopleUser(1));

    $this->actingAs(peopleUser(2))->postJson('/chat/people/thread-1/want')->assertForbidden();
    expect(People::wanted('thread-1'))->toBeNull();
});

it('says what the app wants when the conversation goes to the team, for the tool and the button alike', function () {
    Event::fake([SomeoneWanted::class, ConversationChanged::class]);
    heldConversation(peopleUser(1));
    People::wantedNotice(fn (string $id) => "Back on Monday ({$id})");
    People::answering('thread-1');

    (new AskForSomeone)->handle(new Request(['reason' => 'a refund']));

    $said = Event::dispatched(ConversationChanged::class)->map(fn ($e) => $e[0]->change['message']['content'] ?? null)->filter()->values()->all();
    expect($said)->toBe(['Back on Monday (thread-1)']);
    People::wantedNotice(null);
});
