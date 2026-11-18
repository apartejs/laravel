<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonSaw;
use Aparte\Laravel\People;
use Illuminate\Support\Facades\Event;

it('hears the person typing for a few seconds', function () {
    heldConversation(peopleUser(1));

    expect(People::visitorTyping('thread-1'))->toBeFalse();
    $this->actingAs(peopleUser(1))->postJson('/chat/people/thread-1/typing')->assertNoContent();
    expect(People::visitorTyping('thread-1'))->toBeTrue();

    $this->travel(9)->seconds();
    expect(People::visitorTyping('thread-1'))->toBeFalse();
});

it('tells the desk the person saw what the team wrote', function () {
    Event::fake([PersonSaw::class]);
    heldConversation(peopleUser(1));

    $this->actingAs(peopleUser(1))->postJson('/chat/people/thread-1/seen')->assertNoContent();

    Event::assertDispatched(PersonSaw::class, fn (PersonSaw $e) => $e->conversationId === 'thread-1');
});

it("refuses another person's typing and seen", function () {
    Event::fake([PersonSaw::class]);
    heldConversation(peopleUser(1));

    $this->actingAs(peopleUser(2))->postJson('/chat/people/thread-1/typing')->assertForbidden();
    $this->actingAs(peopleUser(2))->postJson('/chat/people/thread-1/seen')->assertForbidden();
    $this->postJson('/chat/people/nope/typing')->assertNotFound();

    expect(People::visitorTyping('thread-1'))->toBeFalse();
    Event::assertNotDispatched(PersonSaw::class);
});

it('tells the chat someone of the team is typing', function () {
    Event::fake([ConversationChanged::class]);
    heldConversation(peopleUser(1));

    People::typing('thread-1', ['name' => 'Marie', 'avatar' => 'https://example.test/marie.png']);

    Event::assertDispatched(ConversationChanged::class, fn ($e) => $e->change['type'] === 'typing' && $e->change['author']['name'] === 'Marie');
    expect(People::visitorTyping('thread-1'))->toBeFalse();
});
