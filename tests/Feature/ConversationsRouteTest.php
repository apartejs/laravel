<?php

use Aparte\Laravel\AparteServiceProvider;
use Aparte\Laravel\Conversations\ConversationRepository;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Auth\User;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Laravel\Ai\Models\Conversation;

/** Someone signed in. */
function person(int $id): User
{
    return (new User)->forceFill(['id' => $id]);
}

/** A conversation as the chat sends it: what is on screen. */
function shown(array $overrides = []): array
{
    return array_merge([
        'id' => 'conv-1',
        'title' => 'How do I ask for leave?',
        'autoTitle' => true,
        'createdAt' => 1_700_000_000_000,
        'updatedAt' => 1_700_000_100_000,
        'messages' => [
            ['id' => 'm1', 'role' => 'user', 'content' => 'How do I ask for leave?'],
            ['id' => 'm2', 'role' => 'assistant', 'content' => 'Through Time off.', 'segments' => [
                ['id' => 's1', 'type' => 'text', 'content' => 'Through Time off.'],
            ]],
        ],
        'schemaVersion' => 2,
    ], $overrides);
}

it('lists nothing for someone who kept nothing', function () {
    $this->actingAs(person(1))->getJson('/chat/conversations')
        ->assertOk()
        ->assertExactJson(['conversations' => []]);
});

it('gives a conversation back as the chat sent it', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')
        ->assertOk()
        ->assertExactJson(shown());
});

it('keeps an empty object an object, and an empty list a list', function () {
    $json = '{"id":"conv-1","title":"T","createdAt":1,"updatedAt":2,"messages":[{"id":"m1","role":"assistant","content":"","segments":[{"id":"s1","type":"tool_call","toolCall":{"name":"now","input":{}},"children":[]}]}]}';

    $this->actingAs(person(1))
        ->call('PUT', '/chat/conversations/conv-1', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $json)
        ->assertNoContent();

    expect($this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->getContent())
        ->toContain('"input":{}')
        ->toContain('"children":[]');

    // A rename rewrites what is kept: the two must survive that as well.
    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', ['title' => 'Renamed'])->assertNoContent();

    expect($this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->getContent())
        ->toContain('"title":"Renamed"')
        ->toContain('"input":{}')
        ->toContain('"children":[]');
});

it('replaces a conversation saved again', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown(['title' => 'Leave', 'updatedAt' => 1_700_000_200_000]))->assertNoContent();

    $list = $this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations');

    expect($list)->toHaveCount(1)
        ->and($list[0]['title'])->toBe('Leave')
        ->and($list[0]['updatedAt'])->toBe(1_700_000_200_000);
});

it('lists without the messages, the most recent first', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-2', shown(['id' => 'conv-2', 'title' => 'Later', 'updatedAt' => 1_700_000_900_000]))->assertNoContent();

    $list = $this->actingAs(person(1))->getJson('/chat/conversations')->assertOk()->json('conversations');

    expect(array_column($list, 'id'))->toBe(['conv-2', 'conv-1'])
        ->and($list[1])->toBe([
            'id' => 'conv-1',
            'title' => 'How do I ask for leave?',
            'createdAt' => 1_700_000_000_000,
            'updatedAt' => 1_700_000_100_000,
            'schemaVersion' => 2,
        ]);
});

it('lists no more than the limit', function () {
    config(['aparte.conversations.list' => 2]);
    foreach ([1, 2, 3] as $n) {
        $this->actingAs(person(1))->putJson("/chat/conversations/conv-$n", shown(['id' => "conv-$n", 'updatedAt' => $n]))->assertNoContent();
    }

    expect(array_column($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations'), 'id'))
        ->toBe(['conv-3', 'conv-2']);
});

it("never shows, replaces or deletes someone else's conversation", function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(2))->getJson('/chat/conversations/conv-1')->assertNotFound();
    $this->actingAs(person(2))->getJson('/chat/conversations')->assertExactJson(['conversations' => []]);
    $this->actingAs(person(2))->patchJson('/chat/conversations/conv-1', ['title' => 'Taken'])->assertNotFound();
    // The same id under another person is another conversation: theirs.
    $this->actingAs(person(2))->putJson('/chat/conversations/conv-1', shown(['title' => 'Mine']))->assertNoContent();
    $this->actingAs(person(2))->deleteJson('/chat/conversations/conv-1')->assertNoContent();

    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->assertOk()->assertExactJson(shown());
});

it('asks a guest to sign in', function (string $method, string $uri) {
    $this->json($method, $uri, shown())->assertUnauthorized();
})->with([
    'the list' => ['GET', '/chat/conversations'],
    'one conversation' => ['GET', '/chat/conversations/conv-1'],
    'a save' => ['PUT', '/chat/conversations/conv-1'],
    'a rename' => ['PATCH', '/chat/conversations/conv-1'],
    'a delete' => ['DELETE', '/chat/conversations/conv-1'],
]);

it('refuses a conversation heavier than the limit', function () {
    config(['aparte.conversations.max_bytes' => 200]);

    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertStatus(413);
    $this->actingAs(person(1))->getJson('/chat/conversations')->assertExactJson(['conversations' => []]);
});

it('refuses what is not a conversation', function (array $body) {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', $body)->assertStatus(422);
})->with([
    'no messages' => [['id' => 'conv-1', 'title' => 'T', 'createdAt' => 1, 'updatedAt' => 2]],
    'another id than the address' => [shown(['id' => 'conv-2'])],
    'a title that is not text' => [shown(['title' => ['a']])],
    'a date that is not a number' => [shown(['updatedAt' => 'yesterday'])],
]);

it('refuses an id the address cannot carry', function () {
    $this->actingAs(person(1))->getJson('/chat/conversations/'.str_repeat('a', 65))->assertNotFound();
});

it('renames without the messages, and the conversation keeps its date', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', ['title' => 'Leave'])->assertNoContent();

    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')
        // A title someone typed is theirs: the chat no longer re-titles from the first message.
        ->assertExactJson(shown(['title' => 'Leave', 'autoTitle' => false]));
    expect($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0'))
        ->toMatchArray(['title' => 'Leave', 'updatedAt' => 1_700_000_100_000]);
});

it('pins and archives, and takes either back', function (string $field) {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', [$field => 1_700_000_500_000])->assertNoContent();
    expect($this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->json($field))->toBe(1_700_000_500_000)
        ->and($this->actingAs(person(1))->getJson('/chat/conversations')->json("conversations.0.$field"))->toBe(1_700_000_500_000);

    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', [$field => null])->assertNoContent();
    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->assertExactJson(shown());
    expect($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0'))->not->toHaveKey($field);
})->with(['pinnedAt', 'archivedAt']);

it('refuses a change it does not know', function (array $body) {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', $body)->assertStatus(422);
    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->assertExactJson(shown());
})->with([
    'nothing' => [[]],
    'the messages' => [['messages' => []]],
    'a title that is not text' => [['title' => 12]],
    'a date that is not a number' => [['pinnedAt' => 'now']],
]);

it("deletes the conversation, and the model's memory of it", function () {
    $me = person(1);
    Conversation::create(['id' => 'conv-1', 'participant_type' => $me->getMorphClass(), 'participant_id' => 1, 'title' => 'aparté chat']);
    DB::table('agent_conversation_messages')->insert([
        'id' => 'msg-1', 'conversation_id' => 'conv-1', 'participant_type' => $me->getMorphClass(), 'participant_id' => 1,
        'agent' => 'Assistant', 'role' => 'user', 'content' => 'Hello', 'attachments' => '[]', 'steps' => '[]', 'usage' => '{}', 'meta' => '{}',
        'status' => 'completed', 'created_at' => now(), 'updated_at' => now(),
    ]);
    $this->actingAs($me)->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs($me)->deleteJson('/chat/conversations/conv-1')->assertNoContent();

    $this->actingAs($me)->getJson('/chat/conversations/conv-1')->assertNotFound();
    expect(Conversation::find('conv-1'))->toBeNull()
        ->and(DB::table('agent_conversation_messages')->where('conversation_id', 'conv-1')->count())->toBe(0);
});

it("leaves the model's memory of someone else's conversation alone", function () {
    $them = person(1);
    Conversation::create(['id' => 'conv-1', 'participant_type' => $them->getMorphClass(), 'participant_id' => 1, 'title' => 'Theirs']);

    $this->actingAs(person(2))->deleteJson('/chat/conversations/conv-1')->assertNoContent();

    expect(Conversation::find('conv-1'))->not->toBeNull();
});

it('lets an app keep them somewhere else', function () {
    $this->app->singleton(ConversationRepository::class, fn () => new class implements ConversationRepository
    {
        /** @var array<string, array{json: string, meta: array<string, mixed>}> */
        public array $kept = [];

        public function list(Authenticatable $owner): array
        {
            return array_map(fn (string $id) => ['id' => $id] + $this->kept[$id]['meta'], array_keys($this->kept));
        }

        public function find(Authenticatable $owner, string $id): ?string
        {
            return $this->kept[$id]['json'] ?? null;
        }

        public function save(Authenticatable $owner, string $id, string $json, array $meta): void
        {
            $this->kept[$id] = ['json' => $json, 'meta' => $meta];
        }

        public function delete(Authenticatable $owner, string $id): void
        {
            unset($this->kept[$id]);
        }
    });

    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    expect($this->app->make(ConversationRepository::class)->kept)->toHaveKey('conv-1')
        ->and(DB::table('aparte_conversations')->count())->toBe(0)
        ->and($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0.title'))->toBe('How do I ask for leave?');
});

it('points the chat of someone signed in at the routes that keep its conversations', function () {
    $this->actingAs(person(1));

    expect(Blade::render('<x-aparte::chat endpoint="/chat" conversations="/chat/conversations" />'))
        ->toContain('data-aparte-conversations="http://localhost/chat/conversations"');
});

it('leaves a guest, and a chat that did not ask, on the tab', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" conversations="/chat/conversations" />'))
        ->not->toContain('data-aparte-conversations');

    $this->actingAs(person(1));
    expect(Blade::render('<x-aparte::chat endpoint="/chat" />'))->not->toContain('data-aparte-conversations');
});

it('offers its migration to publish, and creates nothing unasked', function () {
    expect(ServiceProvider::pathsToPublish(AparteServiceProvider::class, 'aparte-migrations'))->not->toBeEmpty();
});
