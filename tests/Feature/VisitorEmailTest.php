<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\VisitorLeftEmail;
use Aparte\Laravel\People;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Models\Conversation;

beforeEach(fn () => Event::fake([VisitorLeftEmail::class, ConversationChanged::class]));

/** A conversation of a guest, or of the user given. */
function emailConversation(?User $user = null, string $id = 'thread-1'): Conversation
{
    return Conversation::create(['id' => $id, 'participant_type' => $user?->getMorphClass(), 'participant_id' => $user?->getKey(), 'title' => 'Order']);
}

it('keeps the e-mail a guest leaves for the answer, and tells the desk', function () {
    emailConversation();

    $notice = $this->postJson('/chat/people/thread-1/email', ['email' => 'lea@example.test'])->assertOk()->json('notice');

    expect($notice['kind'])->toBe('notice')
        ->and($notice['content'])->toContain('lea@example.test')
        ->and(People::email('thread-1'))->toBe('lea@example.test');
    Event::assertDispatched(VisitorLeftEmail::class, fn (VisitorLeftEmail $e) => $e->conversationId === 'thread-1' && $e->email === 'lea@example.test');
    expect($this->getJson('/chat/people/thread-1')->json('emailLeft'))->toBeTrue();
});

it('says no e-mail was left until one is', function () {
    emailConversation();

    expect($this->getJson('/chat/people/thread-1')->json('emailLeft'))->toBeFalse()
        ->and($this->getJson('/chat/people/thread-9')->json('emailLeft'))->toBeFalse();
});

it('refuses what is not an e-mail, a conversation not there, or someone else\'s', function () {
    emailConversation((new User)->forceFill(['id' => 1]));

    $this->postJson('/chat/people/thread-1/email', ['email' => 'lea@example.test'])->assertForbidden();
    $this->actingAs((new User)->forceFill(['id' => 1]))->postJson('/chat/people/thread-1/email', ['email' => 'not an e-mail'])->assertUnprocessable();
    $this->postJson('/chat/people/thread-9/email', ['email' => 'lea@example.test'])->assertNotFound();

    Event::assertNotDispatched(VisitorLeftEmail::class);
});

it('offers the field to a guest when the page asks for it, not to someone signed in', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-email="true" />'))->toContain('data-aparte-people-email=')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" />'))->not->toContain('data-aparte-people-email')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" :people-email="true" />'))->not->toContain('data-aparte-people-email');

    $this->actingAs((new User)->forceFill(['id' => 1]));
    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-email="true" />'))->not->toContain('data-aparte-people-email');
});
