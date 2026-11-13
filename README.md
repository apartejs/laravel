# aparté for Laravel

An AI chat for Blade, Livewire and Filament pages, wired to the [Laravel AI SDK](https://laravel.com/docs/ai-sdk).
No React and no build step: replies stream with Markdown, tool calls show as they run, and a person can
approve or refuse them.

![The chat in a Filament panel, asking before a tool runs](https://raw.githubusercontent.com/apartejs/laravel/main/art/filament.jpg)

It is built on [aparté](https://apartejs.dev), a chat UI made of web components, and needs PHP 8.3+, Laravel 12 or 13
and `laravel/ai` 1.3+.

## Install

```bash
composer require apartejs/laravel
php artisan vendor:publish --provider="Laravel\Ai\AiServiceProvider"
php artisan migrate
```

The last two are the SDK's own setup: its configuration and the tables that keep conversations.

## Use it

An agent that keeps its conversations:

```php
namespace App\Ai\Agents;

use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Promptable;

class Assistant implements Agent, Conversational
{
    use Promptable, RemembersConversations;

    public function instructions(): string
    {
        return 'You are a helpful assistant.';
    }
}
```

A route, and the chat in a view. Give it a height:

```php
// routes/web.php
Route::aparte('/chat', App\Ai\Agents\Assistant::class);
```

```blade
<x-aparte::chat endpoint="/chat" style="height: 32rem" />
```

Inside a Livewire component it works as is: it is excluded from Livewire's re-renders.

**Protect the route.** It spends your model budget and runs your tools, so give it the middleware your app needs:

```php
Route::aparte('/chat', App\Ai\Agents\Assistant::class)->middleware(['auth', 'throttle:20,1']);
```

## A button in the corner of the page

```blade
<x-aparte::launcher endpoint="/chat" label="Help" />
```

The chat opens above the button under a header: a title (the button's `label` unless you set `heading`), a line
under it, and a ✕. Add `maximizable` for a button in the header that maximizes the chat to the whole window, or
`maximizable="panel"` for a full-height panel along the edge that keeps the page in view:

```blade
<x-aparte::launcher
    endpoint="/chat"
    label="Help"
    heading="Support"
    subheading="Usually answers in a minute"
    maximizable
/>
```

Escape brings a maximized chat back to its card. The [launcher's page](https://apartejs.dev/components/launcher/)
lists everything it takes, and the header's colours are yours to set in CSS.

## Filament

```php
use Aparte\Laravel\Filament\ApartePlugin;

$panel->plugin(ApartePlugin::make()->agent(App\Ai\Agents\Assistant::class)->label('Assistant'));
```

Works with Filament 4 and 5. Every page of the panel gets the button, for whoever is signed in to it. The route is
added for you, behind the
panel's authentication, and the chat follows the panel's light or dark mode.

The chat opens under a header titled with the `label`. A different title, a line under it and a maximize button are
options of the plugin; there is no maximize button unless you call `maximizable()`:

```php
$panel->plugin(
    ApartePlugin::make()
        ->agent(App\Ai\Agents\Assistant::class)
        ->label('Assistant')
        ->heading('Assistant')
        ->subheading('Answers about your data')
        ->maximizable(), // or ->maximizable('panel') to keep the page in view
);
```

To keep each person's conversations and give the chat its list, publish the table once and call `conversations()`:

```bash
php artisan vendor:publish --tag=aparte-migrations
php artisan migrate
```

```php
$panel->plugin(
    ApartePlugin::make()
        ->agent(App\Ai\Agents\Assistant::class)
        ->maximizable()
        ->conversations(),
);
```

The chat's header then names the open conversation and starts a new one, and a menu button opens the list: a drawer
inside the chat's card, and a column beside the chat once it is maximized. The routes are added for you, behind the
panel's authentication, and each panel keeps a list of its own: its conversations are not those of another panel, or
of a chat on a page of your app. [Conversations in your database](#conversations-in-your-database) says what is kept,
and how to change it.

## Approving tool calls

A tool that needs a person uses the SDK's approvals:

```php
public function tools(): iterable
{
    return [(new SendInvoice)->requireApproval('Sending an invoice.')];
}
```

The chat asks before the tool runs. The model answers a refusal, and reads what the person typed in its place. A pending
question comes back after a reload.

## Slots

```blade
<x-aparte::chat endpoint="/chat" style="height: 32rem">
    <x-slot:empty-state><p>How can I help?</p></x-slot:empty-state>
    <x-slot:above-composer><p>Answers may be wrong.</p></x-slot:above-composer>
    <x-slot:toolbar><button type="button" style="margin-inline-start: auto">Help</button></x-slot:toolbar>
</x-aparte::chat>
```

## A list of conversations

aparté's own elements go in the view around the chat, and follow it with no script of yours:

```blade
<div class="aparte-app-shell" style="height: 40rem" wire:ignore>
    <aparte-sidebar>
        <div class="aparte-sidebar__header">
            <button type="button" class="aparte-btn aparte-btn--surface" data-aparte-new-chat>New chat</button>
        </div>
        <div class="aparte-sidebar__search">
            <input type="search" class="aparte-field" placeholder="Search chats" aria-label="Search chats" data-aparte-sidebar-search>
        </div>
        <div class="aparte-sidebar__body">
            <aparte-conversation-list manage></aparte-conversation-list>
        </div>
    </aparte-sidebar>
    <header class="aparte-app-header">
        <button type="button" class="aparte-btn aparte-app-header__toggle" data-aparte-sidebar-toggle>Chats</button>
        <span class="aparte-app-header__title" data-aparte-title>New chat</span>
    </header>
    <div class="aparte-app-shell__main">
        <x-aparte::chat endpoint="/chat" style="height: 100%" />
    </div>
</div>
```

- `<aparte-conversation-list>` shows the chat's conversations, grouped by date. A click opens one, and with `manage` a
  row's menu renames or deletes it ([its page](https://apartejs.dev/components/conversation-list/)).
- `data-aparte-new-chat` on a button opens an empty conversation.
- `data-aparte-title` on an element names the open conversation; its own words stand while there is no name.
- `<aparte-sidebar>`, its search field and its toggle are aparté's ([its page](https://apartejs.dev/components/sidebar/)):
  on a narrow screen the sidebar becomes a drawer.

An element belongs to the chat in the same block as it. On a page with several chats, give each its own block, or name
the chat: give it an id, `<x-aparte::chat id="support" endpoint="/chat" />`, and write `for="support"` on the element.
`wire:ignore` keeps Livewire from redrawing what the elements draw.

The floating chat draws all of this itself when asked, in its card: a menu button in its header opens the list as a
drawer, and it is a column beside the chat once the chat is maximized.

```blade
<x-aparte::launcher endpoint="/chat" label="Help" maximizable list />
```

The list shows what the chat keeps: by default, the conversations of this tab. Keep them
[in your database](#conversations-in-your-database), or in [a storage of your own](#your-own-storage-your-own-runner).

## Conversations in your database

A chat keeps its conversations for the tab. To keep them for the person signed in, on every device, publish the
table:

```bash
php artisan vendor:publish --tag=aparte-migrations
php artisan migrate
```

Add the routes beside the chat's, behind the middleware that signs people in:

```php
// routes/web.php
Route::middleware(['auth'])->group(function () {
    Route::aparte('/chat', App\Ai\Agents\Assistant::class);
    Route::aparteConversations('/chat/conversations');
});
```

And name them on the chat, on a page behind the same sign-in as the routes:

```blade
<x-aparte::chat endpoint="/chat" conversations="/chat/conversations" style="height: 32rem" />
```

[The list](#a-list-of-conversations) then shows them, and a conversation opens as it was left, tool calls included.

The floating chat takes the same option, and then draws its list for whoever is signed in:

```blade
<x-aparte::launcher endpoint="/chat" conversations="/chat/conversations" label="Help" maximizable />
```

Two chats that answer with two agents keep two lists. The routes of the second one name its own, and chats whose
routes share a name share their conversations:

```php
Route::aparteConversations('/help/conversations', 'help');
```

Its words (`Conversations`, `New chat`, `Search chats`, `Maximize`, `Close`) go through Laravel's translator: give
them in your `lang/*.json` files. In a Filament panel, [`->conversations()`](#filament) does all of this.

- **What is kept** is what the chat shows, as the browser sends it after each reply, in the `aparte_conversations`
  table. Each person reads and writes their own only; a guest's conversations stay in the tab.
- **The model's memory** stays with the Laravel AI SDK, under the same id. Deleting a conversation from the list
  deletes both. Each conversation of a list is its own thread: `thread="..."` is for a chat that has one conversation
  and no list, and is not used on a chat that has one.
- **Whatever answers the chat:** with [a runner of your own](#your-own-storage-your-own-runner), the conversations
  are kept the same way.
- **Limits** are in `config/aparte.php` (`php artisan vendor:publish --tag=aparte-config`): `conversations.max_bytes`,
  what one conversation may weigh (2 MB); `conversations.list`, how many the list gives (200); `conversations.table`.
  Your web server must let a request of that weight through: nginx stops at 1 MB unless `client_max_body_size` says
  otherwise. The routes take your own middleware, a rate limit among them:
  `Route::aparteConversations('/chat/conversations')->middleware('throttle:120,1')`.
- **Somewhere else than that table:** bind your own `Aparte\Laravel\Conversations\ConversationRepository` in a service
  provider. It has five methods: list, find, save, change, delete.
- A reply still being written when its tab was closed is not in what is kept; the model remembers it.
- The same conversation open in two tabs is kept as the last of the two to save left it.
- **If the server does not answer,** the chat goes on. What is said is sent once it answers again: at the next
  message, when the network or the page comes back, and at longer and longer intervals in between.
- **A conversation the server refuses** is not kept: one heavier than `max_bytes`, or anything once nobody is signed
  in any more. The chat says so with an event, on the page, for you to tell the person:

```js
document.addEventListener('aparte-conversations-problem', (event) => {
    // event.detail.reason: 'too-large', 'signed-out', 'unreachable', 'refused' or 'gone' (deleted somewhere else).
    if (event.detail.reason === 'too-large') {
        alert('This conversation is too long to be kept. A new chat starts a fresh one.');
    }
});
```

## Plugins

The package serves a built chat: Markdown, tool calls and approvals. To add aparté's
[plugins](https://apartejs.dev/plugins/) (cards, maths, diagrams, charts, code highlighting) or cards of your own, build
the chat with your app's Vite instead, so that the plugins and the chat share one copy of aparté.

Tell the package to stop serving its own copy, in `.env`:

```env
APARTE_ASSETS=vite
```

Install the chat and the plugins you want:

```bash
npm install @aparte/core@^1 @aparte/runner-ag-ui@^1 @aparte/plugin-marked@^1 marked
npm install @aparte/plugin-katex@^1 katex
```

Give the chat an entry of its own, which imports the package's script and adds each plugin to every chat with
`onAparteSetup`:

```js
// resources/js/chat.js
import { onAparteSetup } from '../../vendor/apartejs/laravel/resources/js/aparte.js';
import 'katex/dist/katex.min.css';
import { setupKatex } from '@aparte/plugin-katex';

onAparteSetup((config) => setupKatex({}, config));
```

Add it to the inputs in `vite.config.js`, so that the production build has it:

```js
laravel({ input: ['resources/css/app.css', 'resources/js/app.js', 'resources/js/chat.js'] }),
```

Load it on the pages that show a chat, with `@vite('resources/js/chat.js')`. In a Filament panel:

```php
use Filament\View\PanelsRenderHook;
use Illuminate\Support\Facades\Blade;

$panel->renderHook(PanelsRenderHook::HEAD_END, fn (): string => Blade::render("@vite('resources/js/chat.js')"));
```

A separate entry keeps your `app.js` out of the panel: a second Alpine, or your app's styles, would break Filament's.

- `onAparteSetup` receives each chat's config, the chat element as its second argument, and its options as the third
  ([below](#your-own-storage-your-own-runner)). What it returns, if a function, runs when the chat stops. Call it at the top level of that entry and keep it synchronous: a chat starts
  once the entry has run.
- The import reads from `vendor/`, so run `composer install` before `npm run build`, in CI and Docker builds too.
- If you install the package from a local path (a Composer path repository), Vite follows the link to the package's
  own folder: add `resolve: { dedupe: ['@aparte/core', '@aparte/runner-ag-ui', '@aparte/plugin-marked', 'marked'] }`
  to `vite.config.js` so that every import resolves from your app.
- After changing `APARTE_ASSETS` in production, run `php artisan config:cache` again.

## Your own storage, your own runner

The chat keeps its conversations for the tab, and your Laravel agent answers it. Both are defaults: in
[Vite mode](#plugins), `onAparteSetup` hands you the chat's options before it starts.

```js
// resources/js/chat.js
import { onAparteSetup } from '../../vendor/apartejs/laravel/resources/js/aparte.js';
import { createIdbStorage } from '@aparte/plugin-storage-idb';
import { createN8nRunner } from '@aparte/runner-n8n';

onAparteSetup((config, chat, options) => {
    // Where the conversations are kept: here in the browser, one database per user.
    options.storage = createIdbStorage({ name: `chat-${chat.dataset.aparteScope}-${chat.id}` });

    // What answers the chat: here an n8n workflow, in place of the package's endpoint.
    options.client.streamRunner = createN8nRunner({ webhookUrl: 'https://your-n8n.example.com/webhook/<id>/chat' });
});
```

- `options.storage` is any aparté [storage adapter](https://apartejs.dev/guides/conversation-persistence/): a few
  functions that load, save and delete a conversation. One that calls routes of yours keeps them in your database.
- `options.client` is what the chat's client is built with. Its `streamRunner` is the package's when the chat has an
  `endpoint`: replace it with a [runner](https://apartejs.dev/providers/) of yours. Or delete it, register a provider
  on `config` and select its model, and aparté's own loop calls the model from the browser: with a key the page can
  read, so for a model on the person's machine, or a key made to be public.
- A chat the package does not answer needs no endpoint: `<x-aparte::chat style="height: 32rem" />`.
- Both are read once, when the chat starts.

## Good to know

- **The look** is set with aparté's [CSS variables](https://apartejs.dev/guides/theming/). It follows the system's light or dark
  mode; `follow-dark-class` makes it follow Tailwind's `dark` class instead.
- **What is kept:** the SDK keeps the conversation in your database, tied to the signed-in user, and the model's memory comes
  from there. What is on screen is kept for the tab: closing it starts a new conversation, unless you keep it
  [in your database](#conversations-in-your-database) or in [a storage of your own](#your-own-storage-your-own-runner).
- **A conversation** is identified by an id the browser creates, or by `thread="..."` on a chat that has one
  conversation and no list.
- **Guests** can chat if your route allows them. Their conversations belong to nobody, so the id is all that protects one.
- **In production,** replies stream through nginx and PHP-FPM with no configuration: the SDK tells nginx not to buffer them.
  Each reply in progress holds a PHP worker until it ends, so count them in `pm.max_children`.
- **The SDK's AG-UI stream,** which this package reads, is not in its documentation yet, so a new `laravel/ai` version could
  change it.
- **The built chat follows aparté:** within a day of a new aparté 1.x, a patch release of this package carries it, once the
  rebuilt chat has passed its browser test. `composer update apartejs/laravel` brings it. In Vite mode, your own
  `npm update` does.

## Develop

```bash
composer install
vendor/bin/pest
npm install && npm run build   # rebuilds dist/, which is committed
cd tests/browser && npm install && node smoke.mjs   # the built chat in Chromium
```

The chat against a real Laravel app (`testbench.yaml` and `workbench/`), with its routes, a session and a database:

```bash
vendor/bin/testbench workbench:build
vendor/bin/testbench serve --port=8000 &
cd tests/browser && APP_URL=http://127.0.0.1:8000 node app.mjs
```

`vendor/bin/testbench workbench:purge-skeleton` puts the test app back as it was: served once, it would otherwise
give `vendor/bin/pest` another base address.

MIT license.
