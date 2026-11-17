<?php

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
