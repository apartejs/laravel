<?php

use Aparte\Laravel\Conversations\ConversationRepository;
use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\People;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Messages\Message;
use Laravel\Ai\Models\Conversation;

afterEach(fn () => People::heldBy(null));

function peopleUser(int $id): User
{
    return (new User)->forceFill(['id' => $id]);
}

function heldConversation(User $user): Conversation
{
    return Conversation::create([
        'id' => 'thread-1',
        'participant_type' => $user->getMorphClass(),
        'participant_id' => $user->getKey(),
        'title' => 'Order',
    ]);
}

/** What the agent reads back of its conversation, as role and text. */
function agentReads(User $user): array
{
    return collect((new TestAgent)->continue('thread-1', as: $user)->messages())
        ->map(fn (Message $m) => [$m->role->value ?? $m->role, $m->content])
        ->all();
}

it('holds nothing by default: the assistant answers', function () {
    expect(People::holder('thread-1'))->toBeNull();
});

it('asks the app who holds a conversation, and fills in a person', function () {
    People::heldBy(fn (string $id) => $id === 'thread-1' ? ['name' => 'Marie', 'avatar' => 'https://example.test/marie.png'] : null);

    expect(People::holder('thread-1'))->toBe(['name' => 'Marie', 'type' => 'human', 'avatar' => 'https://example.test/marie.png'])
        ->and(People::holder('thread-2'))->toBeNull();
});

it("refuses a holder with no name: the chat would have no one to show", function () {
    People::heldBy(fn () => ['avatar' => 'x']);

    People::holder('thread-1');
})->throws(InvalidArgumentException::class, 'name');

it("puts the person's message in the agent's memory, and tells the desk", function () {
    Event::fake([PersonWrote::class]);
    $user = peopleUser(1);
    heldConversation($user);

    People::heard('thread-1', 'm-1', 'Is it shipped?');

    expect(agentReads($user))->toBe([['user', 'Is it shipped?']]);
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->conversationId === 'thread-1' && $e->messageId === 'm-1' && $e->text === 'Is it shipped?');
});

it("puts an advisor's message in the agent's memory under their name", function () {
    $user = peopleUser(1);
    heldConversation($user);
    People::heard('thread-1', 'm-1', 'Is it shipped?');

    People::post('thread-1', ['name' => 'Marie'], 'It ships today.');

    expect(agentReads($user))->toBe([['user', 'Is it shipped?'], ['assistant', 'Marie: It ships today.']]);
});

it('does not run the agent in a conversation a person holds, and keeps the message', function () {
    Event::fake([PersonWrote::class]);
    TestAgent::fake(['The assistant would have said this.']);
    $user = peopleUser(1);
    heldConversation($user);
    People::heldBy(fn () => ['name' => 'Marie']);

    $content = $this->actingAs($user)->postJson('/chat', [
        'threadId' => 'thread-1',
        'runId' => 'run-1',
        'messages' => [['id' => 'm1', 'role' => 'user', 'content' => 'Still there?']],
    ])->assertOk()->streamedContent();

    // A run with nothing in it: the chat draws no reply, and the person's message is not lost.
    expect($content)->toContain('"RUN_STARTED"')->toContain('"RUN_FINISHED"')->not->toContain('TEXT_MESSAGE');
    TestAgent::assertNeverPrompted();
    expect(agentReads($user))->toBe([['user', 'Still there?']]);
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->messageId === 'm1' && $e->text === 'Still there?');
});

it("still refuses someone else's conversation while a person holds it", function () {
    heldConversation(peopleUser(1));
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->actingAs(peopleUser(2))->postJson('/chat', [
        'threadId' => 'thread-1', 'runId' => 'run-1',
        'messages' => [['id' => 'm1', 'role' => 'user', 'content' => 'Hi']],
    ])->assertForbidden();
});

/** The conversation as aparté's manager stored it (tests/Fixtures: produced by @aparte/core 1.13.0). */
function storedFor(User $user): void
{
    $json = file_get_contents(__DIR__.'/../Fixtures/stored-conversation.json');
    $data = json_decode($json, true);
    app(ConversationRepository::class)->save($user, 'default', 'thread-1', $json, [
        'title' => $data['title'], 'createdAt' => $data['createdAt'], 'updatedAt' => $data['updatedAt'],
        'pinnedAt' => null, 'archivedAt' => null, 'schemaVersion' => $data['schemaVersion'],
    ]);
}

function stored(User $user): array
{
    return json_decode(app(ConversationRepository::class)->find($user, 'default', 'thread-1'), true);
}

/** @return list<array<string, mixed>> what was broadcast, in order */
function sentToChat(): array
{
    return Event::dispatched(ConversationChanged::class)->map(fn (array $args) => $args[0]->broadcastWith())->values()->all();
}

it('takes a conversation over: the AI goes quiet, and a notice says who joined', function () {
    Event::fake([ConversationChanged::class]);
    heldConversation(peopleUser(1));

    People::takeOver('thread-1', ['name' => 'Marie']);

    $sent = sentToChat();
    expect($sent[0])->toBe(['type' => 'auto-reply', 'on' => false])
        ->and($sent[1]['type'])->toBe('message')
        ->and($sent[1]['message'])->toMatchArray(['role' => 'assistant', 'kind' => 'notice', 'content' => 'Marie joined the conversation']);
    $event = Event::dispatched(ConversationChanged::class)->first()[0];
    expect($event->broadcastOn()[0]->name)->toBe('private-aparte.conversations.thread-1')
        ->and($event->broadcastAs())->toBe('aparte.changed');
});

it("sends the advisor's message to the chat as theirs, without the name in its text", function () {
    Event::fake([ConversationChanged::class]);
    heldConversation(peopleUser(1));

    $id = People::post('thread-1', ['name' => 'Marie', 'avatar' => 'https://example.test/m.png'], 'It ships today.');

    expect(sentToChat()[0])->toMatchArray(['type' => 'message'])
        ->and(sentToChat()[0]['message'])->toMatchArray([
            'id' => $id, 'role' => 'assistant', 'content' => 'It ships today.',
            'author' => ['name' => 'Marie', 'type' => 'human', 'avatar' => 'https://example.test/m.png'],
        ]);
});

it('marks a message read, and hands the conversation back', function () {
    Event::fake([ConversationChanged::class]);
    heldConversation(peopleUser(1));

    People::read('thread-1', 'u1', 'Read by Marie');
    People::handBack('thread-1');

    $sent = sentToChat();
    expect($sent[0])->toBe(['type' => 'note', 'messageId' => 'u1', 'note' => 'Read by Marie'])
        ->and($sent[1]['message'])->toMatchArray(['kind' => 'notice', 'content' => 'The assistant is back'])
        ->and($sent[2])->toBe(['type' => 'auto-reply', 'on' => true]);
});

it('says the notices in your words', function () {
    Event::fake([ConversationChanged::class]);
    heldConversation(peopleUser(1));

    People::takeOver('thread-1', ['name' => 'Marie'], 'Marie a rejoint la conversation');
    People::handBack('thread-1', "L'assistant est de retour");

    $notices = collect(sentToChat())->where('type', 'message')->pluck('message.content')->all();
    expect($notices)->toBe(['Marie a rejoint la conversation', "L'assistant est de retour"]);
});

it('writes what the desk does into the conversation the chat reopens', function () {
    Event::fake([ConversationChanged::class]);
    $user = peopleUser(1);
    heldConversation($user);
    storedFor($user);

    People::takeOver('thread-1', ['name' => 'Marie']);
    $id = People::post('thread-1', ['name' => 'Marie'], 'It ships today.');
    People::read('thread-1', 'u1', 'Read by Marie');

    $data = stored($user);
    $last = end($data['messages']);
    expect(collect($data['messages'])->pluck('id')->take(2)->all())->toBe(['u1', 'a1'])
        ->and(count($data['messages']))->toBe(4)
        ->and($last)->toMatchArray(['id' => $id, 'author' => ['name' => 'Marie', 'type' => 'human'], 'content' => 'It ships today.'])
        ->and($data['messages'][0]['note'])->toBe('Read by Marie');
    // The branch tree core reopens: the new messages on the active path, after the reply.
    $nodes = collect($data['tree']['messages'])->keyBy('message.id');
    $notice = $data['messages'][2]['id'];
    expect($data['tree']['headId'])->toBe($id)
        ->and($nodes[$notice]['parentId'])->toBe('a1')
        ->and($nodes[$id]['parentId'])->toBe($notice)
        ->and($nodes['u1']['message']['note'])->toBe('Read by Marie')
        ->and($data['updatedAt'])->toBeGreaterThan(1794880555307);
});

it('tells the chat to stay quiet when a message reaches the assistant while a person holds the conversation', function () {
    Event::fake([PersonWrote::class, ConversationChanged::class]);
    TestAgent::fake(['unused']);
    $user = peopleUser(1);
    heldConversation($user);
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->actingAs($user)->postJson('/chat', [
        'threadId' => 'thread-1', 'runId' => 'run-1',
        'messages' => [['id' => 'm1', 'role' => 'user', 'content' => 'Hello?']],
    ])->assertOk()->streamedContent();

    expect(sentToChat())->toBe([['type' => 'auto-reply', 'on' => false]]);
});

it('takes over, posts, marks read and hands back for a signed-in visitor when the app keeps no conversations', function () {
    // The package's table is publish-only: an app that does not keep conversations never has it.
    Illuminate\Support\Facades\Schema::drop('aparte_conversations');
    Event::fake([ConversationChanged::class]);
    $user = peopleUser(1);
    heldConversation($user);

    People::takeOver('thread-1', ['name' => 'Marie']);
    People::post('thread-1', ['name' => 'Marie'], 'It ships today.');
    People::read('thread-1', 'u1', 'Read by Marie');
    People::handBack('thread-1');

    expect(agentReads($user))->toBe([['assistant', 'Marie: It ships today.']])
        ->and(collect(sentToChat())->pluck('type')->all())->toBe(['auto-reply', 'message', 'message', 'note', 'message', 'auto-reply']);
});

it('does not hear a message that reaches a held conversation without an id', function () {
    Event::fake([PersonWrote::class, ConversationChanged::class]);
    TestAgent::fake(['unused']);
    $user = peopleUser(1);
    heldConversation($user);
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->actingAs($user)->postJson('/chat', [
        'threadId' => 'thread-1', 'runId' => 'run-1',
        'messages' => [['role' => 'user', 'content' => 'No id here']],
    ])->assertOk()->streamedContent();

    // Held all the same: the assistant does not run. But PersonWrote always carries the
    // browser's id, which "Read by" needs: a message without one is not heard.
    TestAgent::assertNeverPrompted();
    Event::assertNotDispatched(PersonWrote::class);
    expect(agentReads($user))->toBe([]);
});
