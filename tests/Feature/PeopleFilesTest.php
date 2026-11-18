<?php

use Aparte\Laravel\Events\ConversationChanged;
use Aparte\Laravel\Events\PersonWrote;
use Aparte\Laravel\People;
use Illuminate\Foundation\Auth\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Models\ConversationMessage;

beforeEach(function () {
    Event::fake([PersonWrote::class, ConversationChanged::class]);
    Storage::fake('local');
});

afterEach(fn () => People::heldBy(null));

/** A real one-pixel PNG: what a browser sends for a photo, without the GD extension. */
function pngFile(string $name): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='));
}

/** A conversation the team holds, a guest's unless a user is given. */
function filesConversation(?User $user = null): Conversation
{
    $conversation = Conversation::create(['id' => 'thread-1', 'participant_type' => $user?->getMorphClass(), 'participant_id' => $user?->getKey(), 'title' => 'Order']);
    People::heldBy(fn () => ['name' => 'Marie']);

    return $conversation;
}

it('keeps the files a person sends to the team, and tells the desk', function () {
    filesConversation();

    $attachments = $this->post('/chat/people/thread-1/messages', [
        'id' => 'm-1',
        'content' => 'Here is the broken mug.',
        'files' => [pngFile('broken.png')],
    ], ['Accept' => 'application/json'])->assertOk()->json('attachments');

    expect($attachments)->toHaveCount(1)
        ->and($attachments[0]['name'])->toBe('broken.png')
        ->and($attachments[0]['type'])->toBe('image/png')
        ->and($attachments[0]['url'])->toEndWith('/chat/people/thread-1/files/'.$attachments[0]['id']);
    Storage::disk('local')->assertExists('aparte/people/thread-1/'.$attachments[0]['id'].'/broken.png');
    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->messageId === 'm-1' && $e->attachments[0]['name'] === 'broken.png');
    expect(ConversationMessage::query()->where('conversation_id', 'thread-1')->sole()->meta['aparte']['attachments'][0]['id'])->toBe($attachments[0]['id']);
});

it('sends a file with no words', function () {
    filesConversation();

    $this->post('/chat/people/thread-1/messages', ['id' => 'm-1', 'files' => [UploadedFile::fake()->create('order.pdf', 20, 'application/pdf')]], ['Accept' => 'application/json'])
        ->assertOk();

    Event::assertDispatched(PersonWrote::class, fn (PersonWrote $e) => $e->text === '' && $e->attachments[0]['name'] === 'order.pdf');
});

it('refuses a file too large, of a type the app does not take, or too many', function (array $files) {
    filesConversation();
    config(['aparte.people.files.max_kb' => 100, 'aparte.people.files.max' => 2]);

    $this->post('/chat/people/thread-1/messages', ['id' => 'm-1', 'files' => $files], ['Accept' => 'application/json'])->assertUnprocessable();

    Event::assertNotDispatched(PersonWrote::class);
})->with([
    'too large' => [fn () => [UploadedFile::fake()->create('big.pdf', 200, 'application/pdf')]],
    'a program' => [fn () => [UploadedFile::fake()->create('setup.exe', 10, 'application/x-msdownload')]],
    'a page' => [fn () => [UploadedFile::fake()->create('page.html', 10, 'text/html')]],
    'too many' => [fn () => [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')]],
]);

it('gives a file back only to whoever may read the conversation', function () {
    $owner = (new User)->forceFill(['id' => 1]);
    filesConversation($owner);
    $id = $this->actingAs($owner)->post('/chat/people/thread-1/messages', ['id' => 'm-1', 'files' => [pngFile('broken.png')]], ['Accept' => 'application/json'])
        ->json('attachments.0.id');

    $this->actingAs($owner)->get("/chat/people/thread-1/files/{$id}")->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
    $this->actingAs((new User)->forceFill(['id' => 2]))->get("/chat/people/thread-1/files/{$id}")->assertForbidden();
    $this->actingAs($owner)->get('/chat/people/thread-1/files/not-there')->assertNotFound();
});

it("lets the team send a file, as a link the visitor's chat opens", function () {
    filesConversation();
    $invoice = People::attach('thread-1', UploadedFile::fake()->create('invoice.pdf', 20, 'application/pdf'));

    People::post('thread-1', ['name' => 'Marie'], 'Here is your invoice.', [$invoice]);

    $shown = Event::dispatched(ConversationChanged::class)->map(fn (array $e) => $e[0]->change)->last(fn (array $change) => $change['type'] === 'message');
    expect($shown['message']['content'])->toContain('Here is your invoice.')->toContain('[invoice.pdf]('.$invoice['url'].')')
        ->and($shown['message']['attachments'][0]['name'])->toBe('invoice.pdf');
});

it('offers the paperclip to the team only when the page asks for it', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-files="true" />'))->toContain('data-aparte-people-files=')
        ->and(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" />'))->not->toContain('data-aparte-people-files');
});
