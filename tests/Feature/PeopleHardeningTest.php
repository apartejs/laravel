<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\Events\SomeoneWanted;
use Aparte\Laravel\Events\VisitorLeftEmail;
use Aparte\Laravel\People;
use Illuminate\Foundation\Auth\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Laravel\Ai\Models\Conversation;

beforeEach(function () {
    Event::fake([SomeoneWanted::class, PersonWrote::class, ConversationChanged::class, VisitorLeftEmail::class]);
    Storage::fake('local');
});

afterEach(fn () => People::heldBy(null));

/** A one-pixel PNG, as a browser sends a photo. */
function hardeningPng(string $name): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='));
}

it("refuses a message for the assistant's conversation: nothing is created, nobody is paged", function () {
    $this->postJson('/chat/people/thread-1/messages', ['id' => 'm1', 'content' => 'Hello'])->assertStatus(409);

    expect(Conversation::find('thread-1'))->toBeNull();
    Event::assertNotDispatched(SomeoneWanted::class);
});

it('starts the conversation and hands it over from a chat with the team only', function () {
    $this->postJson('/chat/people/thread-1/messages', ['id' => 'm1', 'content' => 'Hello', 'team' => true])->assertOk();

    expect(Conversation::find('thread-1'))->not->toBeNull();
    Event::assertDispatchedTimes(SomeoneWanted::class, 1);
});

it('takes no file until the app turns them on, whatever the page asks', function () {
    Conversation::create(['id' => 'thread-1', 'title' => 'Order']);
    People::heldBy(fn () => ['name' => 'Marie']);

    $this->post('/chat/people/thread-1/messages', ['id' => 'm1', 'content' => 'Here', 'files' => [hardeningPng('a.png')]], ['Accept' => 'application/json'])
        ->assertUnprocessable();
    expect(Storage::disk('local')->allFiles())->toBe([])
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-files="true" />'))->not->toContain('data-aparte-people-files');

    config(['aparte.people.files.enabled' => true]);
    $this->post('/chat/people/thread-1/messages', ['id' => 'm2', 'content' => 'Here', 'files' => [hardeningPng('a.png')]], ['Accept' => 'application/json'])
        ->assertOk();
    expect(Storage::disk('local')->allFiles())->toHaveCount(1);
});

it("keeps a file under a name no browser would run, and never under dots alone", function () {
    $dir = sys_get_temp_dir();
    file_put_contents($text = $dir.'/aparte-invoice', 'Your invoice is ready');
    file_put_contents($png = $dir.'/aparte-dots', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='));

    $invoice = People::attach('thread-1', new UploadedFile($text, 'invoice.html', 'text/plain', null, true));
    $dots = People::attach('thread-1', new UploadedFile($png, '..', 'image/png', null, true));

    expect($invoice['name'])->toBe('invoice.txt')
        ->and($dots['name'])->toBe('file.png')
        ->and($invoice['url'])->toBe(route(People::FILE_ROUTE, ['conversation' => 'thread-1', 'file' => $invoice['id']]))
        ->and(People::filePath('thread-1', $dots['id']))->toEndWith('/file.png');
});

it("answers no conversation id the SDK cannot keep, nor dots", function (string $id) {
    $this->postJson("/chat/people/{$id}/messages", ['id' => 'm1', 'content' => 'Hello', 'team' => true])->assertNotFound();
})->with([str_repeat('a', 37), '..', '.']);

it('counts what one visitor posts, and stops them past the limit', function () {
    config(['aparte.people.throttle' => 2]);

    $this->postJson('/chat/people/a/want')->assertOk();
    $this->postJson('/chat/people/b/want')->assertOk();
    $this->postJson('/chat/people/c/want')->assertStatus(429);
});

it('hands a conversation over once, even when asked twice', function () {
    Conversation::create(['id' => 'thread-1', 'title' => 'Order']);

    expect(People::want('thread-1', 'a refund'))->toBeArray()
        ->and(People::want('thread-1', 'a refund again'))->toBeNull()
        ->and(People::wanted('thread-1'))->toBe('a refund');
    Event::assertDispatchedTimes(SomeoneWanted::class, 1);
});

it('takes one e-mail address, from a guest, while the team is awaited', function () {
    Conversation::create(['id' => 'thread-1', 'title' => 'Order']);

    $this->postJson('/chat/people/thread-1/email', ['email' => 'lea@example.test'])->assertStatus(409);

    People::want('thread-1', 'a refund');
    $this->postJson('/chat/people/thread-1/email', ['email' => 'lea@example.test'])->assertOk();
    $this->postJson('/chat/people/thread-1/email', ['email' => 'someone@example.test'])->assertStatus(409);
    expect(People::email('thread-1'))->toBe('lea@example.test');

    $user = (new User)->forceFill(['id' => 7]);
    Conversation::create(['id' => 'thread-2', 'title' => 'Mine', 'participant_type' => $user->getMorphClass(), 'participant_id' => 7]);
    People::want('thread-2', 'a refund');
    $this->actingAs($user)->postJson('/chat/people/thread-2/email', ['email' => 'lea@example.test'])->assertForbidden();
});

it("forgets a conversation's address, rating, hand-off and files", function () {
    config(['aparte.people.files.enabled' => true]);
    Conversation::create(['id' => 'thread-1', 'title' => 'Order']);
    People::want('thread-1', 'a refund');
    People::leftEmail('thread-1', 'lea@example.test');
    People::askRating('thread-1');
    People::attach('thread-1', hardeningPng('a.png'));

    People::forget('thread-1');

    expect(People::wanted('thread-1'))->toBeNull()
        ->and(People::email('thread-1'))->toBeNull()
        ->and(People::rating('thread-1'))->toBeNull()
        ->and(Storage::disk('local')->allFiles())->toBe([]);
});

it("gives a named conversation to someone signed in only: guests would share it", function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" thread="help" />'))->not->toContain('data-aparte-thread');

    $this->actingAs((new User)->forceFill(['id' => 7]));
    expect(Blade::render('<x-aparte::chat endpoint="/chat" thread="help" />'))->toContain('data-aparte-thread="help"');
});

it('says which conversation the chat answers for this request only', function () {
    People::answering('thread-1');
    expect(People::answering())->toBe('thread-1');

    app()->forgetInstance('aparte.people.answering');
    expect(People::answering())->toBeNull();
});
