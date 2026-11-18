<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\VisitorRated;
use Aparte\Laravel\People;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Event;
use Laravel\Ai\Models\Conversation;

beforeEach(fn () => Event::fake([VisitorRated::class, ConversationChanged::class]));

function ratedConversation(?User $user = null): Conversation
{
    return Conversation::create(['id' => 'thread-1', 'participant_type' => $user?->getMorphClass(), 'participant_id' => $user?->getKey(), 'title' => 'Order']);
}

it('asks the person how the conversation went, once your team closed it', function () {
    ratedConversation();

    People::askRating('thread-1');

    Event::assertDispatched(ConversationChanged::class, fn (ConversationChanged $e) => $e->change === ['type' => 'rating']);
    expect($this->getJson('/chat/people/thread-1')->json('rating'))->toBe('asked');
});

it('keeps their answer, tells the desk, and thanks them', function () {
    ratedConversation();
    People::askRating('thread-1');

    $notice = $this->postJson('/chat/people/thread-1/rating', ['value' => 'up'])->assertOk()->json('notice');

    expect($notice['kind'])->toBe('notice')
        ->and(People::rating('thread-1'))->toBe('up')
        ->and($this->getJson('/chat/people/thread-1')->json('rating'))->toBe('up');
    Event::assertDispatched(VisitorRated::class, fn (VisitorRated $e) => $e->conversationId === 'thread-1' && $e->value === 'up');
});

it('takes no rating it did not ask for, nor twice, nor anything but up or down', function () {
    ratedConversation();

    $this->postJson('/chat/people/thread-1/rating', ['value' => 'up'])->assertConflict();

    People::askRating('thread-1');
    $this->postJson('/chat/people/thread-1/rating', ['value' => 'great'])->assertUnprocessable();
    $this->postJson('/chat/people/thread-1/rating', ['value' => 'down'])->assertOk();
    $this->postJson('/chat/people/thread-1/rating', ['value' => 'up'])->assertConflict();

    expect(People::rating('thread-1'))->toBe('down');
    Event::assertDispatchedTimes(VisitorRated::class, 1);
});

it("refuses a rating in someone else's conversation", function () {
    ratedConversation((new User)->forceFill(['id' => 1]));
    People::askRating('thread-1');

    $this->actingAs((new User)->forceFill(['id' => 2]))->postJson('/chat/people/thread-1/rating', ['value' => 'up'])->assertForbidden();
});

it('shows the question only when the page asks for it', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-rating="true" />'))->toContain('data-aparte-people-rating=')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" />'))->not->toContain('data-aparte-people-rating');
});
