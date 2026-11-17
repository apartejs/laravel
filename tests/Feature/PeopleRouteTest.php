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

    $this->actingAs($user)->postJson('/chat/people/thread-1/messages', ['id' => 'm-7', 'content' => 'Is it shipped?'])->assertNoContent();

    $read = collect((new TestAgent)->continue('thread-1', as: $user)->messages())->map(fn (Message $m) => $m->content)->all();
    expect($read)->toBe(['Is it shipped?']);
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->conversationId === 'thread-1' && $e->messageId === 'm-7');
});

it("refuses a message in someone else's conversation, or in none", function () {
    ownedBy(routeUser(1));

    $this->actingAs(routeUser(2))->postJson('/chat/people/thread-1/messages', ['id' => 'm', 'content' => 'Hi'])->assertForbidden();
    $this->actingAs(routeUser(1))->postJson('/chat/people/thread-9/messages', ['id' => 'm', 'content' => 'Hi'])->assertNotFound();
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
