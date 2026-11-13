<?php

use Aparte\Laravel\AparteServiceProvider;
use Aparte\Laravel\Conversations\ConversationRepository;
use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Foundation\Auth\User;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Laravel\Ai\Models\Conversation;

/** Someone else's kind of account, with ids of its own. */
class Staff extends User {}

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
    'a date before any date' => [shown(['createdAt' => -1])],
    'a date no column can hold' => [shown(['updatedAt' => 1e19])],
    'a date that is not a whole number' => [shown(['updatedAt' => 1_700_000_100_000.5])],
    'a pin that is not a date' => [shown(['pinnedAt' => 'yes'])],
    'a version no column can hold' => [shown(['schemaVersion' => 70_000])],
]);

it('refuses a body that is not a conversation at all', function (string $body) {
    $this->actingAs(person(1))
        ->call('PUT', '/chat/conversations/conv-1', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $body)
        ->assertStatus(422);

    expect(DB::table('aparte_conversations')->count())->toBe(0);
})->with([
    'not JSON' => ['{"id":"conv-1",'],
    'a list' => ['[{"id":"conv-1"}]'],
    'a word' => ['"conv-1"'],
    'bytes that are not text' => ["{\"id\":\"conv-1\",\"title\":\"\xC3\x28\",\"createdAt\":1,\"updatedAt\":2,\"messages\":[]}"],
]);

it('lists a title a database can hold, whatever the chat sent', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown(['title' => "Leave\u{0000}and\u{0007}more ".str_repeat('é', 300)]))->assertNoContent();

    $title = $this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0.title');

    expect(mb_strlen($title))->toBe(255)
        ->and($title)->toStartWith('Leave and more ')
        ->and(preg_match('/[\x00-\x1F]/', $title))->toBe(0);
});

it('refuses an id the address cannot carry', function (string $id) {
    $this->actingAs(person(1))->putJson('/chat/conversations/'.$id, shown(['id' => rawurldecode($id)]))->assertNotFound();

    expect(DB::table('aparte_conversations')->count())->toBe(0);
})->with([
    'longer than the column' => [str_repeat('a', 65)],
    'a slash' => ['a%2Fb'],
    'a space' => ['a%20b'],
]);

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
    'a list' => [[]],
    'the messages' => [['messages' => []]],
    'a title that is not text' => [['title' => 12]],
    'a date that is not a number' => [['pinnedAt' => 'now']],
]);

it('refuses a change that changes nothing', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))
        ->call('PATCH', '/chat/conversations/conv-1', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], '{}')
        ->assertStatus(422);
});

it('refuses a change heavier than a change can be', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    // A rename is the one way to write without the size of a conversation being weighed.
    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', ['title' => str_repeat('a', 20_000)])->assertStatus(413);

    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->assertExactJson(shown());
});

it('keeps of a long title what the list can show', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', ['title' => str_repeat('é', 400)])->assertNoContent();

    expect($this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->json('title'))->toBe(str_repeat('é', 255))
        ->and($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0.title'))->toBe(str_repeat('é', 255));
});

it('refuses a pin at a date no column can hold', function (mixed $date) {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', ['pinnedAt' => $date])->assertStatus(422);
})->with([-1, 1e19, 12.5]);

it('keeps the list of each chat apart', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    // The same person, in another chat of the app: none of it is there.
    $this->actingAs(person(1))->getJson('/help/conversations')->assertExactJson(['conversations' => []]);
    $this->actingAs(person(1))->getJson('/help/conversations/conv-1')->assertNotFound();
    $this->actingAs(person(1))->patchJson('/help/conversations/conv-1', ['title' => 'Taken'])->assertNotFound();
    $this->actingAs(person(1))->deleteJson('/help/conversations/conv-1')->assertNoContent();

    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->assertOk()->assertExactJson(shown());

    // And the same id there is another conversation.
    $this->actingAs(person(1))->putJson('/help/conversations/conv-1', shown(['title' => 'Help']))->assertNoContent();
    expect($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0.title'))->toBe('How do I ask for leave?')
        ->and($this->actingAs(person(1))->getJson('/help/conversations')->json('conversations.0.title'))->toBe('Help');
});

it('keeps two kinds of account apart, even with the same id', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();
    $staff = (new Staff)->forceFill(['id' => 1]);

    $this->actingAs($staff)->getJson('/chat/conversations')->assertExactJson(['conversations' => []]);
    $this->actingAs($staff)->getJson('/chat/conversations/conv-1')->assertNotFound();
});

it('keeps accounts that are not models apart by the guard they signed in on', function () {
    config(['auth.guards.staff' => ['driver' => 'session', 'provider' => 'users']]);

    $this->actingAs(new GenericUser(['id' => 5]), 'web')->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(new GenericUser(['id' => 5]), 'staff')->getJson('/chat/conversations')->assertExactJson(['conversations' => []]);
    $this->actingAs(new GenericUser(['id' => 5]), 'web')->getJson('/chat/conversations')->assertJsonCount(1, 'conversations');
});

it('keeps conversations for an account whose id is not a number', function () {
    $me = new class extends User
    {
        protected $table = 'users';

        public $incrementing = false;

        protected $keyType = 'string';
    };
    $me->forceFill(['id' => '0190a1b2-uuid']);
    $this->actingAs($me)->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs($me)->getJson('/chat/conversations')->assertJsonCount(1, 'conversations');
    $this->actingAs(person(1))->getJson('/chat/conversations')->assertExactJson(['conversations' => []]);
});

it('lists what is pinned before the limit cuts the rest', function () {
    config(['aparte.conversations.list' => 2]);
    foreach ([1, 2, 3] as $n) {
        $this->actingAs(person(1))->putJson("/chat/conversations/conv-$n", shown(['id' => "conv-$n", 'updatedAt' => $n] + ($n === 1 ? ['pinnedAt' => 5] : [])))->assertNoContent();
    }

    expect(array_column($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations'), 'id'))
        ->toBe(['conv-1', 'conv-3']);
});

it('falls back on its own limits when the configuration holds none', function () {
    config(['aparte.conversations.list' => null, 'aparte.conversations.max_bytes' => null]);

    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->getJson('/chat/conversations')->assertJsonCount(1, 'conversations');
});

it('changes a kept conversation in one step', function () {
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();
    $conversations = app(ConversationRepository::class);

    $changed = $conversations->change(person(1), 'default', 'conv-1', fn (string $json): array => [
        str_replace('How do I ask for leave?', 'Leave', $json),
        ['title' => 'Leave', 'createdAt' => 1, 'updatedAt' => 2, 'pinnedAt' => null, 'archivedAt' => null, 'schemaVersion' => null],
    ]);

    expect($changed)->toBeTrue()
        ->and($conversations->find(person(1), 'default', 'conv-1'))->toContain('"title":"Leave"')
        ->and($conversations->change(person(1), 'default', 'not-there', fn (string $json): array => [$json, []]))->toBeFalse()
        ->and($conversations->change(person(2), 'default', 'conv-1', fn (string $json): array => [$json, []]))->toBeFalse();
});

it('lets the routes take the middleware of the app', function () {
    $before = count(app('router')->getRoutes()->getRoutes());

    app('router')->aparteConversations('/own/conversations', 'own')->middleware('auth:staff');

    $added = array_slice(app('router')->getRoutes()->getRoutes(), $before);
    expect($added)->toHaveCount(5);
    foreach ($added as $route) {
        expect($route->gatherMiddleware())->toContain('auth:staff');
    }
});

it('refuses a scope an address or a column cannot carry', function (string $scope) {
    app('router')->aparteConversations('/own/conversations', $scope);
})->with(['', 'a b', str_repeat('a', 65)])->throws(InvalidArgumentException::class);

it('has its routes ready before any provider boots', function () {
    // A panel, or another package, registers routes while it boots, in an order nobody chose.
    Router::flushMacros();

    (new AparteServiceProvider($this->app))->register();

    expect(Router::hasMacro('aparte'))->toBeTrue()
        ->and(Router::hasMacro('aparteConversations'))->toBeTrue();
});

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

it("leaves the model's memory of a conversation the list never kept", function () {
    // Something else of the app's talks to the model for this person: it is not the chat's to forget.
    $me = person(1);
    Conversation::create(['id' => 'conv-9', 'participant_type' => $me->getMorphClass(), 'participant_id' => 1, 'title' => 'A report in the making']);

    $this->actingAs($me)->deleteJson('/chat/conversations/conv-9')->assertNoContent();

    expect(Conversation::find('conv-9'))->not->toBeNull();
});

it('forgets the memory kept under the key the model knows the person by', function () {
    // Signed in by an email, known to the model by a number: the two are not the same value.
    $me = new class extends User
    {
        protected $table = 'users';

        public function getAuthIdentifierName()
        {
            return 'email';
        }
    };
    $me->forceFill(['id' => 7, 'email' => 'paul@example.test']);
    Conversation::create(['id' => 'conv-1', 'participant_type' => $me->getMorphClass(), 'participant_id' => 7, 'title' => 'aparté chat']);
    $this->actingAs($me)->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs($me)->deleteJson('/chat/conversations/conv-1')->assertNoContent();

    expect(Conversation::find('conv-1'))->toBeNull();
});

it('deletes a conversation in an app whose model keeps no memory', function () {
    Schema::drop('agent_conversation_messages');
    Schema::drop('agent_conversations');
    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    $this->actingAs(person(1))->deleteJson('/chat/conversations/conv-1')->assertNoContent();

    $this->actingAs(person(1))->getJson('/chat/conversations/conv-1')->assertNotFound();
});

it('lets an app keep them somewhere else', function () {
    $this->app->singleton(ConversationRepository::class, fn () => new class implements ConversationRepository
    {
        /** @var array<string, array{json: string, meta: array<string, mixed>}> */
        public array $kept = [];

        public function list(Authenticatable $owner, string $scope): array
        {
            return array_map(fn (string $id) => ['id' => $id] + $this->kept[$id]['meta'], array_keys($this->kept));
        }

        public function find(Authenticatable $owner, string $scope, string $id): ?string
        {
            return $this->kept[$id]['json'] ?? null;
        }

        public function save(Authenticatable $owner, string $scope, string $id, string $json, array $meta): void
        {
            $this->kept[$id] = ['json' => $json, 'meta' => $meta];
        }

        public function change(Authenticatable $owner, string $scope, string $id, Closure $change): bool
        {
            if (! isset($this->kept[$id])) {
                return false;
            }
            [$json, $meta] = $change($this->kept[$id]['json']);
            $this->kept[$id] = ['json' => $json, 'meta' => $meta];

            return true;
        }

        public function delete(Authenticatable $owner, string $scope, string $id): bool
        {
            $had = isset($this->kept[$id]);
            unset($this->kept[$id]);

            return $had;
        }
    });

    $this->actingAs(person(1))->putJson('/chat/conversations/conv-1', shown())->assertNoContent();

    expect($this->app->make(ConversationRepository::class)->kept)->toHaveKey('conv-1')
        ->and(DB::table('aparte_conversations')->count())->toBe(0)
        ->and($this->actingAs(person(1))->getJson('/chat/conversations')->json('conversations.0.title'))->toBe('How do I ask for leave?');

    // A rename goes through the same store.
    $this->actingAs(person(1))->patchJson('/chat/conversations/conv-1', ['title' => 'Leave'])->assertNoContent();
    expect($this->app->make(ConversationRepository::class)->kept['conv-1']['meta']['title'])->toBe('Leave');
});

it('points the chat of someone signed in at the routes that keep its conversations', function () {
    $this->actingAs(person(1));

    expect(Blade::render('<x-aparte::chat endpoint="/chat" conversations="/chat/conversations" />'))
        ->toContain('data-aparte-conversations="'.url('/chat/conversations').'"');
});

it('leaves a guest, and a chat that did not ask, on the tab', function () {
    expect(Blade::render('<x-aparte::chat endpoint="/chat" conversations="/chat/conversations" />'))
        ->not->toContain('data-aparte-conversations');

    $this->actingAs(person(1));
    expect(Blade::render('<x-aparte::chat endpoint="/chat" />'))->not->toContain('data-aparte-conversations');
});

it('offers its migration to publish, and creates nothing unasked', function () {
    expect(ServiceProvider::pathsToPublish(AparteServiceProvider::class, 'aparte-migrations'))->not->toBeEmpty();

    // `migrate` runs what the migrator was told about: the package tells it nothing.
    $own = realpath(dirname(__DIR__, 2).'/database/migrations');
    expect(array_filter(app('migrator')->paths(), fn (string $path): bool => realpath($path) === $own))->toBe([]);
});

it('gives the floating chat a list, a new-chat control and a header of its own', function () {
    $this->actingAs(person(1));

    $html = Blade::render('<x-aparte::launcher endpoint="/chat" conversations="/chat/conversations" label="Help" maximizable />');

    expect($html)
        // The card is the launcher's one child, and the chat is inside it.
        ->toMatch('/<aparte-launcher[^>]*>\s*<div class="aparte-app-shell/')
        ->toContain('<aparte-conversation-list manage')
        ->toContain('data-aparte-sidebar-toggle')
        ->toContain('data-aparte-sidebar-search')
        ->toContain('data-aparte-new-chat')
        ->toContain('data-aparte-launcher-maximize')
        ->toContain('data-aparte-launcher-close')
        ->toMatch('/data-aparte-title[^>]*>\s*Help\s*</')
        ->toContain('data-aparte-conversations="'.url('/chat/conversations').'"');
});

it('names the floating chat after its heading when it has one', function () {
    $this->actingAs(person(1));

    expect(Blade::render('<x-aparte::launcher endpoint="/chat" conversations="/chat/conversations" label="Help" heading="Support" />'))
        ->toMatch('/data-aparte-title[^>]*>\s*Support\s*</')
        // No maximize control the launcher was not given.
        ->not->toContain('data-aparte-launcher-maximize');
});

it('leaves the floating chat as it was for a guest, and without conversations', function () {
    $guest = Blade::render('<x-aparte::launcher endpoint="/chat" conversations="/chat/conversations" label="Help" />');

    $this->actingAs(person(1));
    $plain = Blade::render('<x-aparte::launcher endpoint="/chat" label="Help" />');

    foreach ([$guest, $plain] as $html) {
        expect($html)
            ->toMatch('/<aparte-launcher[^>]*>\s*<aparte-chat/')
            ->not->toContain('aparte-conversation-list')
            ->not->toContain('data-aparte-conversations');
    }
});
