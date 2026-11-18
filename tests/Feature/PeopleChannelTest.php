<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\People;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Models\Conversation;

afterEach(fn () => People::heldBy(null));

function channelUser(int $id): User
{
    return (new User)->forceFill(['id' => $id]);
}

function conversationFor(?User $user, string $id = 'thread-1'): Conversation
{
    return Conversation::create([
        'id' => $id,
        'participant_type' => $user?->getMorphClass(),
        'participant_id' => $user?->getKey(),
        'title' => 'Order',
    ]);
}

it("broadcasts a signed-in person's conversation on its private channel", function () {
    Event::fake([ConversationChanged::class]);
    conversationFor(channelUser(1));

    People::announce('thread-1', ['type' => 'auto-reply', 'on' => false]);

    $channel = Event::dispatched(ConversationChanged::class)->first()[0]->broadcastOn()[0];
    expect($channel)->toBeInstanceOf(PrivateChannel::class)
        ->and($channel->name)->toBe('private-aparte.conversations.thread-1');
});

it("broadcasts a guest's conversation on a public channel nobody can guess", function () {
    Event::fake([ConversationChanged::class]);
    conversationFor(null);

    People::announce('thread-1', ['type' => 'auto-reply', 'on' => false]);

    $channel = Event::dispatched(ConversationChanged::class)->first()[0]->broadcastOn()[0];
    expect($channel)->not->toBeInstanceOf(PrivateChannel::class)
        ->and($channel->name)->toStartWith('aparte.conversations.thread-1.')
        ->and($channel->name)->toBe(People::channel('thread-1', null)['name'])
        ->and(strlen($channel->name))->toBeGreaterThan(strlen('aparte.conversations.thread-1.') + 30);
});

it('names a guest channel from the app key: another app, another name', function () {
    $first = People::channel('thread-1', null)['name'];
    config(['app.key' => 'base64:'.base64_encode(str_repeat('b', 32))]);

    expect(People::channel('thread-1', null)['name'])->not->toBe($first);
});

it('tells the chat which channel to listen on, with who holds the conversation', function () {
    $user = channelUser(1);
    conversationFor($user);
    conversationFor(null, 'guest-1');

    $this->actingAs($user)->getJson('/chat/people/thread-1')
        ->assertOk()
        ->assertExactJson(['heldBy' => null, 'wanted' => false, 'channel' => ['name' => 'aparte.conversations.thread-1', 'private' => true]]);

    auth()->logout();
    $guest = $this->getJson('/chat/people/guest-1')->assertOk()->json('channel');
    expect($guest)->toBe(['name' => People::channel('guest-1', null)['name'], 'private' => false]);

    // A conversation not there yet: the channel it will have, for whoever asks.
    expect($this->getJson('/chat/people/new-1')->json('channel'))->toBe(['name' => People::channel('new-1', null)['name'], 'private' => false]);
});

it('lets a channel authorization check who owns a conversation', function () {
    conversationFor(channelUser(1));

    expect(People::owns(channelUser(1), 'thread-1'))->toBeTrue()
        ->and(People::owns(channelUser(2), 'thread-1'))->toBeFalse()
        ->and(People::owns(channelUser(1), 'missing'))->toBeFalse();
});
