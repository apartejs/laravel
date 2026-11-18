<?php

use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\People;
use Aparte\Laravel\Tests\Fixtures\TestAgent;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Messages\Message;
use Laravel\Ai\Models\Conversation;

afterEach(fn () => People::heldBy(null));

function routeUser(int $id): User
{
    return (new User)->forceFill(['id' => $id]);
}

function ownedBy(?User $user): Conversation
{
    return Conversation::create([
        'id' => 'thread-1',
        'participant_type' => $user?->getMorphClass(),
        'participant_id' => $user?->getKey(),
        'title' => 'Order',
    ]);
}

it('says nobody holds a conversation by default', function () {
    $user = routeUser(1);
    ownedBy($user);

    $this->actingAs($user)->getJson('/chat/people/thread-1')->assertOk()->assertJsonPath('heldBy', null);
});

it('says who holds a conversation, as the chat shows them', function () {
    $user = routeUser(1);
    ownedBy($user);
    People::heldBy(fn () => ['name' => 'Marie', 'avatar' => 'https://example.test/marie.png']);

    $this->actingAs($user)->getJson('/chat/people/thread-1')
        ->assertOk()
        ->assertJsonPath('heldBy', ['name' => 'Marie', 'type' => 'human', 'avatar' => 'https://example.test/marie.png']);
});

it('answers a guest for a guest conversation, and nobody for one that is not there yet', function () {
    ownedBy(null);
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->getJson('/chat/people/thread-1')->assertOk()->assertJsonPath('heldBy.name', 'Marie');
    $this->getJson('/chat/people/thread-2')->assertOk()->assertJsonPath('heldBy', null);
});

it("does not tell who holds someone else's conversation", function () {
    ownedBy(routeUser(1));
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->actingAs(routeUser(2))->getJson('/chat/people/thread-1')->assertForbidden();
});

it('keeps what the person writes while someone holds the conversation, and tells the desk', function () {
    Event::fake([PersonWrote::class]);
    $user = routeUser(1);
    ownedBy($user);
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->actingAs($user)->postJson('/chat/people/thread-1/messages', ['id' => 'm-7', 'content' => 'Is it shipped?'])->assertNoContent();

    $read = collect((new TestAgent)->continue('thread-1', as: $user)->messages())->map(fn (Message $m) => $m->content)->all();
    expect($read)->toBe(['Is it shipped?']);
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->conversationId === 'thread-1' && $e->messageId === 'm-7');
});

it("refuses a message in someone else's conversation", function () {
    ownedBy(routeUser(1));

    $this->actingAs(routeUser(2))->postJson('/chat/people/thread-1/messages', ['id' => 'm', 'content' => 'Hi'])->assertForbidden();
});

it('hands a chat without an assistant to the team at its first message, the message as the reason', function () {
    Event::fake([PersonWrote::class, Aparte\Laravel\Events\SomeoneWanted::class, Aparte\Laravel\Events\ConversationChanged::class]);

    // A guest's conversation the browser has just started: nothing on the server yet.
    $notice = $this->postJson('/chat/people/new-1/messages', ['id' => 'm-1', 'content' => 'Do you deliver to Belgium?', 'team' => true])
        ->assertOk()
        ->json('notice');

    expect($notice['kind'])->toBe('notice')
        ->and(People::wanted('new-1'))->toBe('Do you deliver to Belgium?')
        ->and(Conversation::find('new-1')?->title)->toBe('Do you deliver to Belgium?');
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->conversationId === 'new-1' && $e->messageId === 'm-1');
    Event::assertDispatched(Aparte\Laravel\Events\SomeoneWanted::class, fn ($e) => $e->conversationId === 'new-1' && $e->source === 'message');
    $read = collect((new TestAgent)->continue('new-1', as: null)->messages())->map(fn (Message $m) => $m->content)->all();
    expect($read[0])->toBe('Do you deliver to Belgium?');

    // The next message waits with it: the team is asked once.
    $this->postJson('/chat/people/new-1/messages', ['id' => 'm-2', 'content' => 'Or France?'])->assertNoContent();
    Event::assertDispatchedTimes(Aparte\Laravel\Events\SomeoneWanted::class, 1);
    expect(People::wanted('new-1'))->toBe('Do you deliver to Belgium?');
});

it('creates nothing for a message it refuses', function () {
    $this->postJson('/chat/people/new-1/messages', ['id' => 'm', 'content' => '  '])->assertUnprocessable();

    expect(Conversation::find('new-1'))->toBeNull()
        ->and(People::wanted('new-1'))->toBeNull();
});

it('refuses a message with no text, a text too long, or no usable id', function (array $body) {
    $user = routeUser(1);
    ownedBy($user);

    $this->actingAs($user)->postJson('/chat/people/thread-1/messages', $body)->assertUnprocessable();
})->with([
    'no text' => [['id' => 'm', 'content' => '  ']],
    'too long' => [['id' => 'm', 'content' => str_repeat('a', 20001)]],
    'no id' => [['content' => 'Hi']],
    'an id too long' => [['id' => str_repeat('a', 65), 'content' => 'Hi']],
]);
