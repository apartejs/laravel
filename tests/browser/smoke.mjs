// The built chat (dist/aparte.js and .css) in Chromium, as the Blade components put it on a page: the chat mounts,
// a message goes out once with the CSRF header, and the AG-UI reply streams in as Markdown. A new aparté that
// breaks the package's script fails here, before anyone installs it.
//
// Then what an app puts around the chat, as an app using a framework wrapper can: a list of conversations written
// in the view, two chats that each keep their own, and a storage and a runner of the app's in place of the package's.
//
// `BROWSER=firefox` or `BROWSER=webkit` runs it in that engine instead of Chromium.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const PORT = 5298;
const ORIGIN = `http://127.0.0.1:${PORT}`;
/** The requests of the first page, answered with Markdown. */
const posts = [];
/** The requests of every other page, answered "Reply N". */
const turns = [];

const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Smoke</title></head>
<body style="height: 600px; margin: 0">
<link rel="stylesheet" href="/aparte.css">
<script type="module" src="/aparte.js"></script>`;
const chat = (id, endpoint, more = '') => `<aparte-chat id="${id}" data-aparte-endpoint="${endpoint}" data-aparte-csrf="test-token" data-aparte-scope="" ${more} style="height: 100%"></aparte-chat>`;
/** A chat with its list, as a view writes them: aparté's own elements, two attributes of the package. */
const shell = (id, chatId, height = 290, more = '') => `<div id="${id}" class="aparte-app-shell" style="height: ${height}px">
    <aparte-sidebar>
        <div class="aparte-sidebar__header"><button type="button" class="aparte-btn aparte-btn--surface" data-aparte-new-chat>New chat</button></div>
        <div class="aparte-sidebar__search"><input class="aparte-field" type="search" aria-label="Search chats" data-aparte-sidebar-search></div>
        <div class="aparte-sidebar__body"><aparte-conversation-list manage></aparte-conversation-list></div>
    </aparte-sidebar>
    <header class="aparte-app-header">
        <button type="button" class="aparte-btn aparte-app-header__toggle" data-aparte-sidebar-toggle>Chats</button>
        <span class="aparte-app-header__title" data-aparte-title>New chat</span>
    </header>
    <div class="aparte-app-shell__main"><div wire:ignore style="height: 100%">${chat(chatId, `${ORIGIN}/turns`, more)}</div></div>
</div>`;

/** The floating chat with its conversations kept, as the launcher's Blade component writes it. */
const control = 'aparte-btn aparte-btn--icon aparte-btn--ghost';
const floating = (chatId, more) => `<aparte-launcher label="Chat" maximizable>
    <section class="aparte-app-shell">
        <aparte-sidebar>
            <div class="aparte-sidebar__header">
                <span class="aparte-sidebar__brand">Conversations</span>
                <button type="button" class="${control}" aria-label="New chat" data-aparte-new-chat><aparte-icon name="edit"></aparte-icon></button>
            </div>
            <div class="aparte-sidebar__search"><input type="search" class="aparte-field aparte-field--sm" aria-label="Search chats" data-aparte-sidebar-search></div>
            <div class="aparte-sidebar__body"><aparte-conversation-list target="${chatId}" manage></aparte-conversation-list></div>
        </aparte-sidebar>
        <header class="aparte-app-header">
            <button type="button" class="${control} aparte-app-header__toggle" aria-label="Conversations" data-aparte-sidebar-toggle><aparte-icon name="menu"></aparte-icon></button>
            <div class="aparte-launcher__heading"><span class="aparte-app-header__title" data-aparte-title="Chat">Chat</span></div>
            <div class="aparte-app-header__actions">
                <button type="button" class="${control}" aria-label="New chat" data-aparte-new-chat><aparte-icon name="edit"></aparte-icon></button>
                <button type="button" class="${control}" aria-label="Maximize" data-aparte-launcher-maximize><aparte-icon name="maximize"></aparte-icon></button>
                <button type="button" class="${control}" aria-label="Close" data-aparte-launcher-close><aparte-icon name="close"></aparte-icon></button>
            </div>
        </header>
        <div class="aparte-app-shell__main">${chat(chatId, `${ORIGIN}/turns`, more)}</div>
    </section>
</aparte-launcher>`;

/** Where the five routes a view names with `conversations="…"` are, on this server. */
const API = '/kept/conversations';
/** What a server keeps for the person signed in, behind those routes. */
const kept = new Map();
/** Every request those routes received: the method, the id, the token against forged requests. */
const calls = [];
/** The people routes a view names with `people="…"`: who holds each conversation, and what the person wrote meanwhile. */
const PEOPLE = '/people';
const held = new Map();
const heard = [];
const wants = [];
const emails = [];
const ratings = [];
const typings = [];
const seens = [];
/** What the tests make of that server: down (every route answers 500), slow to list, strict on weight. */
const server_ = { down: false, listDelay: 0, maxBytes: Infinity, peopleOnly: false };

const pages = {
    '/': `${head}${chat('aparte-chat-1', `${ORIGIN}/chat`)}</body></html>`,
    // The page's language, as the Blade component gives it from app()->getLocale().
    '/french': `${head}${chat('aparte-chat-1', `${ORIGIN}/chat`, 'data-aparte-locale="fr"')}</body></html>`,
    '/klingon': `${head}${chat('aparte-chat-1', `${ORIGIN}/chat`, 'data-aparte-locale="tlh"')}</body></html>`,
    '/taiwan': `${head}${chat('aparte-chat-1', `${ORIGIN}/chat`, 'data-aparte-locale="zh_TW"')}</body></html>`,
    // Tall enough for a row's menu to open inside the sidebar.
    '/conversations': `${head}${shell('shell-a', 'aparte-chat-1', 580)}</body></html>`,
    // The same view, its conversations kept by the server.
    '/kept': `${head}${shell('shell-a', 'aparte-chat-1', 580, `data-aparte-conversations="${ORIGIN}/kept/conversations"`)}</body></html>`,
    // The floating chat, in the corner of a page of the app, its conversations kept by the server.
    '/floating': `${head}<main style="padding: 40px"><h1>Orders</h1></main>${floating('aparte-chat-1', `data-aparte-conversations="${ORIGIN}/kept/conversations"`)}</body></html>`,
    // A list outside both blocks names its chat.
    '/two-chats': `${head}${shell('shell-a', 'aparte-chat-1')}${shell('shell-b', 'aparte-chat-2')}<aparte-conversation-list id="loose" for="aparte-chat-2"></aparte-conversation-list></body></html>`,
    // A chat that is one conversation, named by the view; and the same name on a chat that has a list.
    '/thread': `${head}${chat('aparte-chat-1', `${ORIGIN}/turns`, 'data-aparte-thread="order-42"')}</body></html>`,
    '/thread-list': `${head}${shell('shell-a', 'aparte-chat-1', 580, 'data-aparte-thread="order-42"')}</body></html>`,
    // No endpoint: nothing of the package's answers this chat. The app's entry brings a storage and a runner.
    '/own': `${head}
<script type="module">
    import { onAparteSetup } from '/aparte.js';
    window.saved = [];
    window.runs = 0;
    onAparteSetup((config, chat, options) => {
        const kept = new Map();
        options.storage = {
            async loadAll() { return [...kept.values()]; },
            async save(conversation) { kept.set(conversation.id, conversation); window.saved.push(conversation.id); },
            async delete(id) { kept.delete(id); },
        };
        options.client.streamRunner = async (run) => {
            window.runs += 1;
            run.emitter({ type: 'run-start' });
            run.emitter({ type: 'turn-start' });
            run.emitter({ type: 'text-delta', delta: 'From a runner of the app' });
            run.emitter({ type: 'text-flush' });
            run.emitter({ type: 'run-done', finishReason: 'stop' });
            return undefined;
        };
    });
</script>
${chat('aparte-chat-1', '')}</body></html>`,
    // A chat with the team only: no endpoint, the people routes.
    '/people-only': `${head}${shell('shell-a', 'aparte-chat-1', 580, `data-aparte-people="${ORIGIN}/people" data-aparte-people-button="Talk to a person" data-aparte-people-email="Get the answer by e-mail too" data-aparte-people-email-placeholder="Your e-mail" data-aparte-people-email-send="Send" data-aparte-people-files=".png,.txt,.pdf" data-aparte-people-rating="How was this conversation?" data-aparte-people-rating-up="Good" data-aparte-people-rating-down="Not good"`).replace(`data-aparte-endpoint="${ORIGIN}/turns"`, 'data-aparte-endpoint=""')}</body></html>`,
    // A chat someone of the team can take over: the people routes, and Echo as the app sets it up.
    '/people': `${head}${shell('shell-a', 'aparte-chat-1', 580, `data-aparte-people="${ORIGIN}/people" data-aparte-people-button="Talk to a person" data-aparte-people-rating="How was this conversation?" data-aparte-people-rating-up="Good" data-aparte-people-rating-down="Not good" data-aparte-people-email="Get the answer by e-mail too" data-aparte-people-email-placeholder="Your e-mail" data-aparte-people-email-send="Send"`)}</body></html>`,
    // A run the server ends with one of aparté's codes: the card says its sentence.
    '/failing': `${head}${chat('aparte-chat-1', `${ORIGIN}/fails`)}</body></html>`,
    // The same, on a page that builds nothing: a plain script listens for `aparte:setup` and
    // draws the card with the message under the sentence.
    '/failing-shown': `${head}
<script>
    window.setups = [];
    document.addEventListener('aparte:setup', ({ detail: { config, chat } }) => {
        window.setups.push(chat.id);
        config.setErrorRenderer(({ sentence, message }) => {
            const card = document.createElement('div');
            card.className = 'shown-error';
            card.append(sentence ?? message);
            const detail = document.createElement('pre');
            detail.textContent = message;
            card.append(detail);
            return card;
        });
    });
</script>
${chat('aparte-chat-1', `${ORIGIN}/fails`)}</body></html>`,
    // `files`: the paperclip for the model, as <x-aparte::chat files="image/*,text/*"> writes it.
    '/files': `${head}${chat('aparte-chat-1', `${ORIGIN}/turns`, 'attachments data-aparte-files="image/*,text/*"')}</body></html>`,
    // The same with a slot: the composer is the view's (data-aparte-laravel-shell), as the Blade partial writes it.
    '/files-slotted': `${head}<aparte-chat id="aparte-chat-1" data-aparte-endpoint="${ORIGIN}/turns" data-aparte-csrf="test-token" data-aparte-scope="" attachments data-aparte-files="image/*,text/*" style="height: 100%">
    <aparte-chat-viewport></aparte-chat-viewport>
    <aparte-elicitation></aparte-elicitation>
    <aparte-composer placeholder="Ask">
        <div class="aparte-composer-shell" data-aparte-laravel-shell>
            <aparte-composer-attachments></aparte-composer-attachments>
            <div class="aparte-composer-row">
                <aparte-composer-add-attachment></aparte-composer-add-attachment>
                <aparte-composer-input></aparte-composer-input>
                <aparte-composer-send></aparte-composer-send>
            </div>
            <aparte-composer-toolbar><span class="tools">TOOLS</span></aparte-composer-toolbar>
        </div>
    </aparte-composer>
</aparte-chat></body></html>`,
    // A composer the view wrote with a paperclip, on a chat without `attachments`: a page Livewire restored after the
    // team's code had taken the paperclip back. The package puts it in step when the chat starts.
    '/files-stale': `${head}<aparte-chat id="aparte-chat-1" data-aparte-endpoint="${ORIGIN}/turns" data-aparte-csrf="test-token" data-aparte-scope="" style="height: 100%">
    <aparte-chat-viewport></aparte-chat-viewport>
    <aparte-composer>
        <div class="aparte-composer-shell" data-aparte-laravel-shell>
            <aparte-composer-attachments></aparte-composer-attachments>
            <div class="aparte-composer-row">
                <aparte-composer-add-attachment></aparte-composer-add-attachment>
                <aparte-composer-input></aparte-composer-input>
                <aparte-composer-send></aparte-composer-send>
            </div>
        </div>
    </aparte-composer>
</aparte-chat></body></html>`,
    // The same, with its conversations kept on the server.
    '/files-kept': `${head}${chat('aparte-chat-1', `${ORIGIN}/turns`, `attachments data-aparte-files="image/*,text/*" data-aparte-conversations="${ORIGIN}/kept/conversations"`)}</body></html>`,
    // Both kinds of files: the model's while the assistant answers, the team's while someone of it holds the conversation.
    '/files-people': `${head}${shell('shell-a', 'aparte-chat-1', 580, `data-aparte-people="${ORIGIN}/people" attachments data-aparte-files="image/*" data-aparte-people-files=".png,.txt,.pdf"`)}</body></html>`,
    // An endpoint behind a server that refuses a request over 100 KB, as nginx does over 1 MB by default.
    '/files-small': `${head}${chat('aparte-chat-1', `${ORIGIN}/small`, 'attachments data-aparte-files="image/*"')}</body></html>`,
    // Retry and edit on, as an app turns them on in its setup: the model's memory follows the branch on screen.
    '/memory': `${head}<script>document.addEventListener('aparte:setup', (event) => event.detail.config.setBubbleActions({ retry: true, edit: true }));</script>
${chat('aparte-chat-1', `${ORIGIN}/turns`)}</body></html>`,
    // `:models="true"`: the list of config('aparte.models') in the composer, as the Blade partial writes it.
    '/models': `${head}<aparte-chat id="aparte-chat-1" data-aparte-endpoint="${ORIGIN}/turns" data-aparte-csrf="test-token" data-aparte-scope="" style="height: 100%">
    <aparte-chat-viewport></aparte-chat-viewport>
    <aparte-elicitation></aparte-elicitation>
    <aparte-composer>
        <div class="aparte-composer-shell" data-aparte-laravel-shell>
            <div class="aparte-composer-row">
                <aparte-composer-input></aparte-composer-input>
                <aparte-composer-send></aparte-composer-send>
            </div>
            <aparte-composer-toolbar>
                <aparte-select data-aparte-model aria-label="Model" value="anthropic:claude-sonnet-5-5">
                    <aparte-option value="anthropic:claude-sonnet-5-5">Claude Sonnet</aparte-option>
                    <aparte-option value="anthropic:claude-haiku-5-5">Claude Haiku</aparte-option>
                </aparte-select>
            </aparte-composer-toolbar>
        </div>
    </aparte-composer>
</aparte-chat></body></html>`,
};

/** The images a run's messages carry, as AG-UI content parts (what @aparte/runner-ag-ui sends). */
const imagePartsIn = (input) => (input.messages ?? [])
    .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
    .filter((part) => part.type === 'image' && part.source?.type === 'data' && part.source.value);
const imagesIn = (input) => imagePartsIn(input).length;
/** A JPEG's width and height, read from its frame header. */
const jpegSize = (bytes) => {
    for (let at = 2; at + 9 < bytes.length;) {
        if (bytes[at] !== 0xff) return null;
        const marker = bytes[at + 1];
        const length = bytes.readUInt16BE(at + 2);
        if (marker >= 0xc0 && marker <= 0xc3) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
        at += 2 + length;
    }
    return null;
};
/** What the endpoint received of each image: its type, its weight, and a JPEG's size. */
const imageFacts = (input) => imagePartsIn(input).map((part) => {
    const bytes = Buffer.from(part.source.value, 'base64');
    return { type: part.source.mimeType, bytes: bytes.length, size: part.source.mimeType === 'image/jpeg' ? jpegSize(bytes) : null };
});
/** A 1×1 PNG, to attach. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

/** Requests the server refused for their size (`/small`). */
const refused = [];

const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/small') {
        // What nginx answers over its limit: a 413 page, before the app sees anything.
        let size = 0;
        req.on('data', (chunk) => (size += chunk.length));
        req.on('end', () => {
            refused.push(size);
            res.writeHead(413, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>413 Request Entity Too Large</h1></body></html>');
        });
        return;
    }
    if (req.method === 'POST' && (req.url === '/chat' || req.url === '/turns' || req.url === '/fails')) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            const input = JSON.parse(body);
            const event = (data) => `data: ${JSON.stringify(data)}\n\n`;
            const deltas = req.url === '/chat' ? ['**Hello** from ', 'the built chat'] : [`Reply ${turns.length + 1}`];
            (req.url === '/chat' ? posts : turns).push({ csrf: req.headers['x-csrf-token'], threadId: input.threadId, images: imagesIn(input), imageFacts: imageFacts(input), bytes: body.length, model: input.forwardedProps?.model, shown: input.forwardedProps?.aparte });
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            if (req.url === '/fails') {
                // What AparteProtocol sends for a rate limit, the app's description having named the exception.
                return res.end(
                    event({ type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId })
                    + event({ type: 'RUN_ERROR', message: 'RuntimeException: Quota of user 42.', code: 'USAGE_RATE_LIMIT' }),
                );
            }
            // On /chat, the assistant first hands the conversation over, as AskForSomeone does: the
            // visitor never sees that call, only the words around it.
            const handOff = req.url !== '/chat' ? '' : event({ type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'AskForSomeone' })
                + event({ type: 'TOOL_CALL_ARGS', toolCallId: 't1', delta: '{"reason":"asked for a person"}' })
                + event({ type: 'TOOL_CALL_END', toolCallId: 't1' })
                + event({ type: 'TOOL_CALL_RESULT', messageId: 'r1', toolCallId: 't1', role: 'tool', content: 'The team was told and will answer here.' });
            res.end(
                event({ type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId })
                + handOff
                + event({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' })
                + deltas.map((delta) => event({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta })).join('')
                + event({ type: 'TEXT_MESSAGE_END', messageId: 'm1' })
                + event({ type: 'RUN_FINISHED', threadId: input.threadId, runId: input.runId }),
            );
        });
        return;
    }
    // The two people routes, as PeopleController answers them.
    if (req.url.startsWith(`${PEOPLE}/`)) {
        const [id, rest] = decodeURIComponent(req.url.slice(PEOPLE.length + 1)).split('/');
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            if (req.method === 'POST' && (rest === 'typing' || rest === 'seen')) {
                (rest === 'typing' ? typings : seens).push(id);
                res.writeHead(204);
                return res.end();
            }
            if (req.method === 'POST' && rest === 'rating') {
                ratings.push({ id, csrf: req.headers['x-csrf-token'], ...JSON.parse(body) });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ notice: { id: `rated-${id}`, role: 'assistant', kind: 'notice', content: 'Thank you for your answer', timestamp: Date.now() } }));
            }
            if (req.method === 'POST' && rest === 'email') {
                emails.push({ id, csrf: req.headers['x-csrf-token'], ...JSON.parse(body) });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ notice: { id: `email-${id}`, role: 'assistant', kind: 'notice', content: `We will also answer you at ${JSON.parse(body).email}`, timestamp: Date.now() } }));
            }
            if (req.method === 'POST' && rest === 'want') {
                wants.push(id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ notice: { id: `wanted-${id}`, role: 'assistant', kind: 'notice', content: 'Someone of the team will answer you here', timestamp: Date.now() } }));
            }
            if (req.method === 'POST' && rest === 'messages' && String(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) {
                // Files to the team: the form the chat sends, and what the server keeps of them.
                heard.push({ id, csrf: req.headers['x-csrf-token'], multipart: true, file: /filename="note\.txt"/.test(body), content: /name="content"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? '' });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ attachments: [{ id: 'f1', name: 'note.txt', type: 'text/plain', size: 5, url: `${ORIGIN}${PEOPLE}/${id}/files/f1` }] }));
            }
            if (req.method === 'POST' && rest === 'messages') {
                heard.push({ id, csrf: req.headers['x-csrf-token'], ...JSON.parse(body) });
                // A chat without an assistant: the first message puts the conversation in the queue.
                if (server_.peopleOnly && !wants.includes(id) && !held.has(id)) {
                    wants.push(id);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ notice: { id: `wanted-${id}`, role: 'assistant', kind: 'notice', content: 'Someone of the team will answer you here', timestamp: Date.now() } }));
                }
                res.writeHead(204);
                return res.end();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ heldBy: held.get(id) ?? null, wanted: wants.includes(id), emailLeft: emails.some((e) => e.id === id), channel: { name: `aparte.conversations.${id}.secret`, private: false } }));
        });
        return;
    }
    // The five routes, as the package's controller answers them.
    if (req.url === API || req.url.startsWith(`${API}/`)) {
        const id = decodeURIComponent(req.url.slice(API.length + 1));
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            calls.push({ method: req.method, id, csrf: req.headers['x-csrf-token'], xsrf: req.headers['x-xsrf-token'] });
            const json = (status, data) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(data === undefined ? '' : JSON.stringify(data));
            };
            if (server_.down) return json(500, { message: 'Server Error' });
            if (req.url === API) {
                const list = [...kept.values()].sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(({ messages, tree, autoTitle, ...meta }) => meta);
                return setTimeout(() => json(200, { conversations: list }), server_.listDelay);
            }
            if (req.method === 'PUT') {
                if (body.length > server_.maxBytes) return json(413, { message: 'This conversation is too large to keep.' });
                kept.set(id, JSON.parse(body));
                return json(204);
            }
            if (!kept.has(id)) return json(404, { message: 'Not found' });
            if (req.method === 'GET') return json(200, kept.get(id));
            if (req.method === 'DELETE') {
                kept.delete(id);
                return json(204);
            }
            // PATCH: a title, a pin or an archive date; null takes one back.
            const conversation = kept.get(id);
            for (const [field, value] of Object.entries(JSON.parse(body))) {
                if (value === null) delete conversation[field];
                else conversation[field] = value;
            }
            return json(204);
        });
        return;
    }
    const file = { '/aparte.js': ['aparte.js', 'text/javascript'], '/aparte.css': ['aparte.css', 'text/css'] }[req.url];
    if (file) {
        res.writeHead(200, { 'Content-Type': file[1] });
        return res.end(readFileSync(dist + file[0]));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pages[req.url] ?? pages['/']);
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

let failed = false;
const check = (ok, label) => {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
    if (!ok) failed = true;
};
/** True as soon as `probe` is, false once `ms` have passed. */
const until = async (probe, ms = 10_000) => {
    const end = Date.now() + ms;
    for (;;) {
        if (await probe().catch(() => false)) return true;
        if (Date.now() > end) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
};

/** A group of checks; one that throws is one failure, and the next group still runs. */
const scenario = async (name, run) => {
    try {
        await run();
    } catch (error) {
        check(false, `${name}: stopped on ${String(error?.message ?? error).split('\n')[0]}`);
    }
};

const engine = { chromium, firefox, webkit }[process.env.BROWSER ?? 'chromium'];
if (!engine) throw new Error(`BROWSER=${process.env.BROWSER}: chromium, firefox or webkit`);
const browser = await engine.launch();
/** A page of the server, with what its console complained about. */
const open = async (path, prepare = async () => {}) => {
    const page = await browser.newPage();
    const problems = [];
    // What the chat tells the page of conversations that are not kept.
    await page.addInitScript(() => {
        window.notKept = [];
        document.addEventListener('aparte-conversations-problem', (event) => window.notKept.push(event.detail));
    });
    await prepare(page);
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await page.goto(`${ORIGIN}${path}`);
    return { page, problems };
};
/** One chat of a page: say something, read what it shows. */
const chatOf = (page, scope) => {
    const root = page.locator(scope);
    const editor = root.locator('aparte-chat .aparte-ci-editor');
    const transcript = () => root.locator('aparte-chat aparte-chat-viewport').textContent();
    return {
        rows: root.locator('aparte-conversation-list [data-conv-id]'),
        newChat: root.locator('[data-aparte-new-chat]'),
        title: root.locator('[data-aparte-title]'),
        transcript,
        /** Send `text` and wait for the reply the server gives it. */
        async say(text) {
            const reply = `Reply ${turns.length + 1}`;
            await editor.waitFor({ state: 'visible', timeout: 20_000 });
            await editor.click();
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
            return until(async () => (await transcript()).includes(reply) && (await root.locator('aparte-chat .aparte-message-streaming').count()) === 0, 20_000);
        },
    };
};

try {
    // ── The chat as the Blade component puts it on a page ──────────────────────────────────
    await scenario('chat', async () => {
        const { page, problems } = await open('/');
        const editor = page.locator('aparte-chat .aparte-ci-editor');
        await editor.waitFor({ state: 'visible', timeout: 20_000 });
        const mounted = await page.waitForFunction(() => document.querySelector('aparte-chat')?.hasAttribute('data-aparte-mounted'), null, { timeout: 10_000 })
            .then(() => true, () => false);
        check(mounted, 'the chat mounts');

        await editor.click();
        await page.keyboard.type('Hi');
        await page.keyboard.press('Enter');
        const drawn = await page.waitForFunction(() => {
            const strong = document.querySelector('aparte-chat strong');
            return strong?.textContent === 'Hello' && document.querySelector('aparte-chat')?.textContent.includes('the built chat');
        }, null, { timeout: 20_000 }).then(() => true, () => false);
        check(drawn, 'the streamed reply is drawn, with its Markdown');
        check(!((await page.locator('aparte-chat aparte-chat-viewport').textContent()) ?? '').includes('AskForSomeone'), 'the hand-off to the team draws no tool row');
        check(posts.length === 1, `one request for one message (got ${posts.length})`);
        check(posts[0]?.csrf === 'test-token', 'the CSRF header is sent');
        check(typeof posts[0]?.threadId === 'string' && posts[0].threadId.length > 0, 'the request names its thread');
        check(problems.length === 0, `no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── The chat's own words in the page's language ────────────────────────────────────────
    await scenario('language', async () => {
        const label = async (path) => {
            const { page, problems } = await open(path);
            const editor = page.locator('aparte-chat .aparte-ci-editor');
            await editor.waitFor({ state: 'visible', timeout: 20_000 });
            await page.waitForFunction(() => document.querySelector('aparte-chat')?.hasAttribute('data-aparte-mounted'), null, { timeout: 10_000 }).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 300));
            const text = await editor.getAttribute('aria-label');
            await page.close();
            return { text, problems };
        };
        const french = await label('/french');
        check(french.text === 'Écrivez un message...', `language: a French page writes the composer in French (got ${french.text})`);
        check(french.problems.length === 0, `language: no console error or warning${french.problems.length ? `: ${french.problems.join(' | ')}` : ''}`);
        const unknown = await label('/klingon');
        check(unknown.text === 'Type a message...', `language: a language aparté does not speak stays English (got ${unknown.text})`);
        const traditional = await label('/taiwan');
        check(traditional.text === 'Type a message...', `language: Traditional Chinese is not given Simplified words (got ${traditional.text})`);
    });

    // ── A list of conversations written in the view ────────────────────────────────────────
    await scenario('list', async () => {
        const { page, problems } = await open('/conversations');
        const a = chatOf(page, '#shell-a');
        check(await a.say('First question'), 'list: the chat answers inside a shell');
        check(await until(async () => (await a.rows.count()) === 1), 'list: the list written in the view shows the conversation');
        check(((await a.rows.first().textContent().catch(() => '')) ?? '').includes('First question'), 'list: the row is named after the first message');
        check(await until(async () => (await a.title.textContent()) === 'First question'), 'list: the title element names the open conversation');

        await a.newChat.click();
        check(await until(async () => !(await a.transcript()).includes('First question')), 'list: the new-chat control opens an empty conversation');
        check(await until(async () => (await a.title.textContent()) === 'New chat'), 'list: the title element goes back to its own words');
        await a.say('Second question');
        check(await until(async () => (await a.rows.count()) === 2), 'list: a second conversation joins the list');
        check(new Set(turns.map((turn) => turn.threadId)).size === 2, 'list: each conversation is its own thread on the server');

        await a.rows.filter({ hasText: 'First question' }).locator('.aparte-conv-item__select').click();
        check(await until(async () => {
            const text = await a.transcript();
            return text.includes('Reply 1') && !text.includes('Second question');
        }), 'list: a click on a row opens that conversation');

        await page.locator('[data-aparte-sidebar-search]').fill('Second');
        check(await until(async () => (await a.rows.filter({ visible: true }).count()) === 1), "list: the sidebar's search filters the rows");
        await page.locator('[data-aparte-sidebar-search]').fill('');

        const second = a.rows.filter({ hasText: 'Second question' });
        await second.locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="delete"]').click();
        await page.locator('[data-menu-action="confirm-delete"]').click();
        check(await until(async () => (await a.rows.count()) === 1), "list: the row's menu deletes the conversation, in the chat's own storage");

        await page.reload();
        const again = chatOf(page, '#shell-a');
        check(await until(async () => (await again.rows.count()) === 1), 'list: the list is there again after a reload');
        check(problems.length === 0, `list: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── Two chats on a page, each with its list ────────────────────────────────────────────
    await scenario('two chats', async () => {
        const { page, problems } = await open('/two-chats');
        const a = chatOf(page, '#shell-a');
        const b = chatOf(page, '#shell-b');
        await a.say('Alpha');
        check(await until(async () => (await a.rows.count()) === 1) && (await b.rows.count()) === 0, 'two chats: a list shows the conversations of its own chat');
        await b.say('Beta');
        await a.newChat.click();
        await until(async () => !(await a.transcript()).includes('Alpha'));
        check((await b.transcript()).includes('Beta'), "two chats: one chat's new-chat control leaves the other alone");
        await a.rows.filter({ hasText: 'Alpha' }).locator('.aparte-conv-item__select').click();
        check(await until(async () => (await a.transcript()).includes('Alpha')), 'two chats: a click on a row opens it in its own chat');
        check((await b.transcript()).includes('Beta'), 'two chats: and leaves the other chat on its conversation');
        const loose = page.locator('#loose [data-conv-id]');
        check(await until(async () => (await loose.count()) === 1) && ((await loose.first().textContent()) ?? '').includes('Beta'), 'two chats: a list outside both blocks shows the chat it names');
        check(problems.length === 0, `two chats: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── A storage and a runner of the app's ────────────────────────────────────────────────
    await scenario('own', async () => {
        const before = turns.length + posts.length;
        const { page, problems } = await open('/own');
        const editor = page.locator('aparte-chat .aparte-ci-editor');
        await editor.waitFor({ state: 'visible', timeout: 20_000 });
        await editor.click();
        await page.keyboard.type('Hi');
        await page.keyboard.press('Enter');
        check(await until(async () => ((await page.locator('aparte-chat aparte-chat-viewport').textContent()) ?? '').includes('From a runner of the app')), 'own: the runner the app gave answers the chat');
        check((await page.evaluate(() => window.runs)) === 1, 'own: it ran once for one message');
        check(turns.length + posts.length === before, 'own: nothing was sent to an endpoint of the package');
        check(await until(async () => (await page.evaluate(() => window.saved.length)) > 0), 'own: the conversation is saved in the storage the app gave');
        check((await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('aparte-laravel:')).length)) === 0, "own: and not in the tab's");
        check(problems.length === 0, `own: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── Conversations kept by the server, for the person signed in ─────────────────────────
    await scenario('kept', async () => {
        const first = await open('/kept');
        const a = chatOf(first.page, '#shell-a');
        check(await a.say('First question'), 'kept: the chat answers');
        check(await until(async () => kept.size === 1), 'kept: the conversation is sent to the server');
        // Saved as the turn goes, so the first save can come before the answer is whole: the last one is what counts.
        const whole = () => [...kept.values()][0];
        check(await until(async () => whole()?.title === 'First question' && whole()?.messages?.length === 2), 'kept: with its title and what is on screen');
        const saved = whole();
        check(calls.some((call) => call.method === 'PUT') && calls.every((call) => call.csrf === 'test-token'), 'kept: every request carries the CSRF header');
        check((await first.page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('aparte-laravel:')).length)) === 0, 'kept: and nothing is written in the tab');
        check(first.problems.length === 0, `kept: no console error or warning${first.problems.length ? `: ${first.problems.join(' | ')}` : ''}`);
        await first.page.close();

        // Another tab, another device: it has nothing of the first page's but what the server kept.
        const { page, problems } = await open('/kept');
        const b = chatOf(page, '#shell-a');
        check(await until(async () => (await b.rows.count()) === 1), 'kept: another page lists it, from the server');
        check(await until(async () => (await b.transcript()).includes('First question')), 'kept: and opens it with its messages');
        await b.newChat.click();
        await until(async () => !(await b.transcript()).includes('First question'));
        await b.say('Second question');
        check(await until(async () => kept.size === 2), 'kept: a second conversation is kept too');

        // Once the reply is kept: what follows must be the rename's doing alone.
        await until(async () => [...kept.values()].some((conversation) => conversation.title === 'Second question' && conversation.messages.length === 2));
        const beforeRename = calls.length;
        await b.rows.filter({ hasText: 'Second question' }).locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="rename"]').click();
        const input = page.locator('.aparte-conv-item__input');
        await input.fill('Leave');
        await input.press('Enter');
        check(await until(async () => [...kept.values()].some((conversation) => conversation.title === 'Leave')), 'kept: a rename reaches the server');
        const sinceRename = calls.slice(beforeRename).map((call) => call.method);
        check(sinceRename.includes('PATCH') && !sinceRename.includes('PUT'), `kept: without its messages travelling (${sinceRename.join(', ')})`);

        await b.rows.filter({ hasText: 'Leave' }).locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="delete"]').click();
        await page.locator('[data-menu-action="confirm-delete"]').click();
        check(await until(async () => kept.size === 1 && [...kept.values()][0].title === 'First question'), 'kept: a delete reaches the server');
        check(problems.length === 0, `kept: no console error or warning on the second page${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── The floating chat, with its list ───────────────────────────────────────────────────
    await scenario('floating', async () => {
        kept.clear();
        const { page, problems } = await open('/floating');
        const sidebar = () => page.evaluate(() => {
            const card = document.querySelector('aparte-launcher > .aparte-app-shell').getBoundingClientRect();
            const element = document.querySelector('aparte-sidebar');
            const list = element.getBoundingClientRect();
            return {
                drawer: element.hasAttribute('data-drawer'),
                closed: element.hasAttribute('collapsed'),
                wide: list.width > 100,
                inCard: list.left >= card.left - 1 && list.right <= card.right + 1 && list.top >= card.top - 1 && list.bottom <= card.bottom + 1,
            };
        });
        await page.locator('aparte-launcher .aparte-launcher__button').click();
        const c = chatOf(page, 'aparte-launcher');
        check(await c.say('First question'), 'floating: the chat answers in its card');
        check((await page.locator('aparte-launcher > .aparte-launcher__header').count()) === 0, 'floating: the card has one header, its own');
        check(await until(async () => (await c.title.textContent()) === 'First question'), 'floating: which names the conversation');

        await page.locator('.aparte-app-header [data-aparte-new-chat]').click();
        check(await until(async () => !(await c.transcript()).includes('First question')), 'floating: its new-chat control opens an empty conversation');
        await c.say('Second question');
        check(await until(async () => kept.size === 2), 'floating: both conversations are kept by the server');

        await page.locator('[data-aparte-sidebar-toggle]').click();
        check(await until(async () => { const s = await sidebar(); return s.drawer && !s.closed && s.wide && s.inCard; }), 'floating: the list opens inside the card, not over the page');
        check((await c.rows.count()) === 2, 'floating: with both conversations');

        // A row's menu is placed against the window: it must stand at its row, inside the card.
        const first = c.rows.filter({ hasText: 'First question' });
        await first.hover();
        await first.locator('.aparte-conv-item__more').click();
        const menu = page.locator('[role="menu"]');
        await menu.waitFor({ state: 'visible' });
        const more = await first.locator('.aparte-conv-item__more').boundingBox();
        const drawn = await menu.boundingBox();
        check(Math.abs(drawn.y - (more.y + more.height)) < 16 || Math.abs(drawn.y + drawn.height - more.y) < 16, "floating: a row's menu opens at its row");
        await page.keyboard.press('Escape');
        check(await until(async () => (await menu.count()) === 0 || !(await menu.isVisible())), 'floating: Escape closes that menu');
        check(!(await sidebar()).closed, 'floating: and leaves the list open');
        await page.keyboard.press('Escape');
        check(await until(async () => (await sidebar()).closed), 'floating: Escape again closes the list');
        check(await page.locator('aparte-launcher').evaluate((el) => el.hasAttribute('open')), 'floating: and leaves the chat open');
        await page.locator('[data-aparte-sidebar-toggle]').click();
        await until(async () => !(await sidebar()).closed);

        await c.rows.filter({ hasText: 'First question' }).locator('.aparte-conv-item__select').click();
        check(await until(async () => (await sidebar()).closed), 'floating: choosing a conversation closes the list');
        check(await until(async () => (await c.transcript()).includes('First question')), 'floating: and opens it');

        await page.locator('[data-aparte-launcher-maximize]').click();
        check(await until(async () => { const s = await sidebar(); return !s.drawer && !s.closed && s.wide; }), 'floating: maximized, the list is a column beside the chat');
        await page.locator('[data-aparte-launcher-maximize]').click();
        check(await until(async () => { const s = await sidebar(); return s.drawer && s.closed; }), 'floating: and a drawer again once the card is back');
        check(problems.length === 0, `floating: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── A server that does not answer for the conversations, then does ─────────────────────
    await scenario('down', async () => {
        kept.clear();
        kept.set('before', { id: 'before', title: 'Kept before', createdAt: 1, updatedAt: 1, messages: [] });
        server_.down = true;
        const { page, problems } = await open('/kept');
        const a = chatOf(page, '#shell-a');
        check(await a.say('While it is down'), 'down: the chat still answers');
        // Asked three times before it gives up for now: the chat did not wait for that to answer.
        check(await until(async () => problems.some((problem) => problem.includes('will be when the server answers'))), 'down: the console says the conversations will be loaded later');
        check(await until(async () => (await page.evaluate(() => window.notKept.some((problem) => problem.reason === 'unreachable')))), 'down: the page is told that what is said is not kept yet');
        check(kept.size === 1, 'down: the server has nothing of it');
        check((await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('aparte-laravel:')).length)) === 0, "down: and it is not left in the tab, where the server never looks");

        server_.down = false;
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        check(await until(async () => [...kept.values()].some((conversation) => conversation.title === 'While it is down' && conversation.messages?.length === 2)), 'down: once the server answers, what was said is kept');
        check(await until(async () => (await a.rows.count()) === 2), 'down: and the list is read, with what was kept before');
        check((await a.transcript()).includes('While it is down'), 'down: the conversation on screen is still the one being held');
        await page.close();
    });

    // ── A conversation the server refuses for what it is ───────────────────────────────────
    await scenario('refused', async () => {
        kept.clear();
        server_.maxBytes = 300;
        const { page } = await open('/kept');
        const a = chatOf(page, '#shell-a');
        check(await a.say('A question long enough to weigh more than this server takes for one conversation'), 'refused: the chat answers');
        check(await until(async () => (await page.evaluate(() => window.notKept.some((problem) => problem.reason === 'too-large' && typeof problem.conversationId === 'string')))), 'refused: the page is told which conversation is too large to keep');
        const puts = () => calls.filter((call) => call.method === 'PUT').length;
        const sent = puts();
        await new Promise((resolve) => setTimeout(resolve, 2500));
        check(puts() === sent, 'refused: and the same bytes are not sent again and again');
        server_.maxBytes = Infinity;
        await page.close();
    });

    // ── A conversation deleted somewhere else ──────────────────────────────────────────────
    await scenario('gone', async () => {
        kept.clear();
        kept.set('gone-1', { id: 'gone-1', title: 'Deleted elsewhere', createdAt: 1, updatedAt: 2, messages: [{ id: 'm1', role: 'user', content: 'Deleted elsewhere' }] });
        kept.set('here-1', { id: 'here-1', title: 'Still here', createdAt: 1, updatedAt: 3, messages: [{ id: 'm2', role: 'user', content: 'Still here' }] });
        const { page } = await open('/kept');
        const a = chatOf(page, '#shell-a');
        check(await until(async () => (await a.rows.count()) === 2), 'gone: both conversations are listed');
        kept.delete('gone-1');
        await a.rows.filter({ hasText: 'Deleted elsewhere' }).locator('.aparte-conv-item__select').click();
        check(await until(async () => (await a.rows.count()) === 1), 'gone: a click on one deleted from another tab takes its row away');
        await page.close();
    });

    // ── A page left while its conversations were loading (wire:navigate) ───────────────────
    await scenario('navigation', async () => {
        kept.clear();
        server_.listDelay = 700;
        const before = turns.length;
        const { page } = await open('/kept');
        await page.waitForFunction(() => document.querySelector('aparte-chat')?.hasAttribute('data-aparte-mounted'));
        // Livewire swaps the page's body, and says so before and after.
        await page.evaluate(() => {
            document.dispatchEvent(new Event('livewire:navigating'));
            const body = document.body.innerHTML;
            document.body.innerHTML = body;
            document.dispatchEvent(new Event('livewire:navigated'));
        });
        server_.listDelay = 0;
        const a = chatOf(page, '#shell-a');
        check(await a.say('After the navigation'), 'navigation: the chat of the new page answers');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        check(turns.length === before + 1, `navigation: one request for one message, not one more from the page that was left (got ${turns.length - before})`);
        check((await page.locator('#shell-a aparte-chat aparte-chat-bubble[data-role="assistant"]').count()) === 1, 'navigation: and one reply');
        await page.close();
    });

    // ── `thread`, the name of a chat's one conversation ────────────────────────────────────
    await scenario('thread', async () => {
        const one = await open('/thread');
        const before = turns.length;
        await chatOf(one.page, 'body').say('About the order');
        check(turns[before]?.threadId === 'order-42', 'thread: a chat with one conversation sends it under the name the view gave');
        check(one.problems.length === 0, `thread: no console error or warning${one.problems.length ? `: ${one.problems.join(' | ')}` : ''}`);
        await one.page.close();

        const many = await open('/thread-list');
        const a = chatOf(many.page, '#shell-a');
        const start = turns.length;
        await a.say('First');
        await a.newChat.click();
        await until(async () => !(await a.transcript()).includes('First'));
        await a.say('Second');
        const threads = turns.slice(start).map((turn) => turn.threadId);
        check(threads.length === 2 && threads[0] !== threads[1] && !threads.includes('order-42'), 'thread: with a list, each conversation is its own thread, whatever name the view gave');
        check(many.problems.some((problem) => problem.includes('each is its own thread')), 'thread: and the console says the name is not used');
        await many.page.close();
    });

    // ── Laravel's token, as it stands when the request leaves ──────────────────────────────
    await scenario('token', async () => {
        kept.clear();
        const { page } = await open('/kept', (page) => page.context().addCookies([{ name: 'XSRF-TOKEN', value: 'fresh%3Dtoken', url: ORIGIN }]));
        const from = calls.length;
        await chatOf(page, '#shell-a').say('With a cookie');
        await until(async () => calls.slice(from).some((call) => call.method === 'PUT'));
        const put = calls.slice(from).find((call) => call.method === 'PUT');
        check(put?.xsrf === 'fresh=token' && put?.csrf === undefined, "token: the cookie Laravel refreshes is sent, in place of the token the page was drawn with");
        await page.close();
    });

    // ── A run that fails with one of aparté's codes, and a page that draws the card itself ──
    await scenario('errors', async () => {
        const fail = async (path) => {
            const opened = await open(path);
            const editor = opened.page.locator('aparte-chat .aparte-ci-editor');
            await editor.waitFor({ state: 'visible', timeout: 20_000 });
            await editor.click();
            await opened.page.keyboard.type('How many left?');
            await opened.page.keyboard.press('Enter');
            return opened;
        };

        const plain = await fail('/failing');
        const card = plain.page.locator('aparte-chat .aparte-segment-error');
        check(await until(async () => ((await card.textContent()) ?? '').includes('Too many requests right now')), "errors: the card says the code's sentence, a rate limit as one");
        check(!((await card.textContent()) ?? '').includes('Quota of user 42'), 'errors: and not the message, which goes to the console');
        check(plain.problems.some((problem) => problem.includes('A turn failed (USAGE_RATE_LIMIT)') && problem.includes('Quota of user 42')), 'errors: the console names the code and the message');
        await plain.page.close();

        const shown = await fail('/failing-shown');
        check((await shown.page.evaluate(() => window.setups)).join() === 'aparte-chat-1', 'errors: aparte:setup reaches a plain script of the page, once per chat, with its config');
        const custom = shown.page.locator('aparte-chat .shown-error');
        check(await until(async () => ((await custom.textContent()) ?? '').includes('Too many requests right now')), "errors: the page's own card draws the sentence");
        check(((await custom.locator('pre').textContent()) ?? '') === 'RuntimeException: Quota of user 42.', 'errors: and the message under it');
        await shown.page.close();
    });

    // ── Someone of the team takes the conversation over (People) ───────────────────────────
    await scenario('people', async () => {
        // Echo as an app sets it up: the chat listens on the conversation's private channel.
        const echo = async (page) => page.addInitScript(() => {
            const listeners = new Map();
            const subscription = (name) => ({
                listen(event, fn) { listeners.set(`${name}${event}`, fn); return this; },
                stopListening(event) { listeners.delete(`${name}${event}`); return this; },
            });
            window.Echo = {
                private: (name) => subscription(`private:${name}`),
                channel: (name) => subscription(name),
                leave: (name) => { for (const key of [...listeners.keys()]) if (key.startsWith(name)) listeners.delete(key); },
            };
            // A guest's conversation: the public channel under the name the route gave.
            window.desk = (id, change) => listeners.get(`aparte.conversations.${id}.secret.aparte.changed`)?.(change);
            window.listening = (id) => listeners.has(`aparte.conversations.${id}.secret.aparte.changed`);
        });
        const { page, problems } = await open('/people', echo);
        const a = chatOf(page, '#shell-a');
        const send = async (text) => {
            const editor = page.locator('#shell-a aparte-chat .aparte-ci-editor');
            await editor.click();
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
        };
        const desk = (id, change) => page.evaluate(([i, c]) => window.desk(i, c), [id, change]);

        check(await a.say('Where is my order?'), 'people: the assistant answers first');
        const id = turns.at(-1).threadId;
        check(await until(() => page.evaluate((i) => window.listening(i), id)), "people: the chat listens on the conversation's channel");

        const email = page.locator('#shell-a .aparte-laravel-email');
        check(!(await email.isVisible()), 'people: no e-mail field while the assistant answers');
        await desk(id, { type: 'auto-reply', on: false });
        // The assistant's answer is the last message, yet the person now waits for the team.
        check(await until(() => email.isVisible()), 'people: handed over, the person may leave an e-mail for the answer');
        await desk(id, { type: 'message', message: { id: 'n1', role: 'assistant', kind: 'notice', content: 'Marie joined the conversation', timestamp: Date.now() } });
        await desk(id, { type: 'message', message: { id: 'h1', role: 'assistant', author: { name: 'Marie', type: 'human' }, content: 'Hi, I am Marie.', timestamp: Date.now() } });
        check(await until(async () => !(await email.isVisible())), 'people: the field goes once the team has answered');
        check(await until(async () => (await page.locator('aparte-chat-bubble[data-kind="notice"]').count()) === 1), 'people: the notice is drawn');
        check(await until(async () => (await page.locator('aparte-chat-bubble[data-author-type="human"]').getAttribute('name')) === 'Marie'), "people: Marie's message is drawn as hers");
        check(await until(async () => seens.includes(id)), "people: the tab in front tells that the team's message was seen");
        await desk(id, { type: 'typing', author: { name: 'Marie', type: 'human' } });
        const typingLine = page.locator('#shell-a .aparte-laravel-typing');
        check(await until(async () => (await typingLine.isVisible()) && (await typingLine.textContent()) === 'Marie is typing…'), 'people: the visitor sees Marie typing');

        const turnsBefore = turns.length;
        await send('Is it shipped?');
        check(await until(async () => heard.some((h) => h.content === 'Is it shipped?')), 'people: what the person writes goes to the people route');
        check(heard.find((h) => h.content === 'Is it shipped?')?.team === false, 'people: from a chat with an assistant, never as a new hand-off');
        check(typings.includes(id), 'people: and the team hears that they were typing');
        const mine = heard.find((h) => h.content === 'Is it shipped?');
        const bubbleId = await page.locator('aparte-chat-bubble[data-role="user"]').last().getAttribute('message-id');
        check(mine?.id === bubbleId && mine?.csrf === 'test-token', 'people: with the id of the message on screen and the CSRF header');
        await new Promise((resolve) => setTimeout(resolve, 500));
        check(turns.length === turnsBefore, 'people: and the assistant is not asked');

        // The team closes it and asks how it went: two buttons, answered once.
        const rating = page.locator('#shell-a .aparte-laravel-rating');
        check(!(await rating.isVisible()), 'people: no rating question before the team asks');
        await desk(id, { type: 'rating' });
        check(await until(() => rating.isVisible()), 'people: the visitor is asked how it went');
        const noticesBefore = await page.locator('aparte-chat-bubble[data-kind="notice"]').count();
        await rating.locator('button[data-rating="up"]').click();
        check(await until(async () => ratings.some((r) => r.id === id && r.value === 'up' && r.csrf === 'test-token')), 'people: the answer goes to the people route');
        check(await until(async () => !(await rating.isVisible())), 'people: the question goes once answered');
        check(await until(async () => (await page.locator('aparte-chat-bubble[data-kind="notice"]').count()) === noticesBefore + 1), 'people: the visitor is thanked');

        await desk(id, { type: 'note', messageId: bubbleId, note: 'Read by Marie' });
        check(await until(async () => ((await page.locator('aparte-chat-bubble[data-role="user"] .aparte-message-note').last().textContent()) ?? '') === 'Read by Marie'), 'people: the note is drawn under it');

        await desk(id, { type: 'auto-reply', on: true });
        check(await a.say('Thanks!'), 'people: handed back, the assistant answers again');

        // The visitor asks for someone themself, with the button beside send.
        const button = page.locator('#shell-a .aparte-laravel-people button');
        check(await until(() => button.isVisible()), 'people: the visitor sees a way to ask for someone');
        // Counted from before the click: the count it was checked against (2) was already reached by the two notices
        // before it, so the check passed before the new one came, and failed in Firefox once it came first.
        const noticesBeforeAsking = await page.locator('aparte-chat-bubble[data-kind="notice"]').count();
        await button.click();
        check(await until(async () => wants.includes(id)), 'people: the button asks for someone of the team');
        const notices = page.locator('aparte-chat-bubble[data-kind="notice"]');
        check(await until(async () => (await notices.count()) === noticesBeforeAsking + 1 && ((await notices.last().textContent()) ?? '').includes('will answer')), `people: the visitor reads that someone will answer (${JSON.stringify(await notices.allTextContents())})`);
        check(await until(async () => !(await button.isVisible())), 'people: the button goes while the team is asked');
        const turnsWanted = turns.length;
        await send('Hello?');
        check(await until(async () => heard.some((h) => h.content === 'Hello?')), 'people: asked for, the message goes to the people route');
        await new Promise((resolve) => setTimeout(resolve, 500));
        check(turns.length === turnsWanted, 'people: and the assistant is not asked meanwhile');

        // A reload in the middle of a takeover: the chat asks who holds the conversation.
        held.set(id, { name: 'Marie', type: 'human' });
        await page.reload();
        const b = chatOf(page, '#shell-a');
        check(await until(async () => (await b.transcript()).includes('Thanks!')), 'people: reloaded, the conversation opens');
        const turnsAfter = turns.length;
        await send('Still there?');
        check(await until(async () => heard.some((h) => h.content === 'Still there?')), 'people: still held, the message goes to the people route');
        await new Promise((resolve) => setTimeout(resolve, 500));
        check(turns.length === turnsAfter, 'people: and the assistant is not asked');
        check(problems.length === 0, `people: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    await scenario('people only', async () => {
        server_.peopleOnly = true;
        const echo = async (page) => page.addInitScript(() => {
            const listeners = new Map();
            const subscription = (name) => ({
                listen(event, fn) { listeners.set(`${name}${event}`, fn); return this; },
                stopListening(event) { listeners.delete(`${name}${event}`); return this; },
            });
            window.Echo = { private: (name) => subscription(`private:${name}`), channel: (name) => subscription(name), leave: () => {} };
            window.desk = (id, change) => listeners.get(`aparte.conversations.${id}.secret.aparte.changed`)?.(change);
        });
        const desk = (id, change) => page.evaluate(([i, c]) => window.desk(i, c), [id, change]);
        const { page, problems } = await open('/people-only', echo);
        const send = async (text) => {
            const editor = page.locator('#shell-a aparte-chat .aparte-ci-editor');
            await editor.click();
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
        };
        const turnsBefore = turns.length;
        check(await until(() => page.locator('#shell-a aparte-composer').isVisible()), 'people only: the chat is drawn');
        check((await page.locator('#shell-a .aparte-laravel-people').count()) === 0, 'people only: no button to ask for a person, everyone is one');

        await send('Do you deliver to Belgium?');
        check(await until(async () => heard.some((h) => h.content === 'Do you deliver to Belgium?')), 'people only: the first message goes to the team');
        check(heard.find((h) => h.content === 'Do you deliver to Belgium?')?.team === true, 'people only: saying it is a chat with the team only');
        const first = heard.find((h) => h.content === 'Do you deliver to Belgium?');
        const bubbleId = await page.locator('aparte-chat-bubble[data-role="user"]').last().getAttribute('message-id');
        check(first?.id === bubbleId, 'people only: with the id of the message on screen');
        check(await until(async () => (await page.locator('aparte-chat-bubble[data-kind="notice"]').count()) === 1), 'people only: the visitor reads that someone will answer');

        await send('Or France?');
        check(await until(async () => heard.some((h) => h.content === 'Or France?' && h.id !== first?.id)), 'people only: the next one too');
        await new Promise((resolve) => setTimeout(resolve, 500));
        check(turns.length === turnsBefore, 'people only: and no assistant is ever asked');
        check((await page.locator('aparte-chat-bubble[data-kind="notice"]').count()) === 1, 'people only: the notice is said once');

        // The answer by e-mail too: a field while an answer from the team is owed, sent once.
        const emailBox = page.locator('#shell-a .aparte-laravel-email');
        check(await until(() => emailBox.isVisible()), 'people only: the visitor is offered to get the answer by e-mail');
        const conversation = wants.at(-1);
        await desk(conversation, { type: 'message', message: { id: 'h-only', role: 'assistant', author: { name: 'Marie', type: 'human' }, content: 'We do, yes.', timestamp: Date.now() } });
        check(await until(async () => !(await emailBox.isVisible())), 'people only: the field goes once the team has answered');
        await send('And to Spain?');
        check(await until(() => emailBox.isVisible()), 'people only: and comes back with the next question');
        await desk(conversation, { type: 'rating' });
        check(await until(async () => !(await emailBox.isVisible())), 'people only: never beside the rating question');
        await page.locator('#shell-a .aparte-laravel-rating button[data-rating="up"]').click();
        check(await until(() => emailBox.isVisible()), 'people only: back once it is answered, the question still owed');
        check(await until(async () => (await page.locator('aparte-chat-bubble[data-kind="notice"]').last().textContent())?.includes('Thank you for your answer')), 'people only: the visitor is thanked');
        const noticesBefore = await page.locator('aparte-chat-bubble[data-kind="notice"]').count();
        await emailBox.locator('input[type="email"]').fill('lea@example.test');
        await emailBox.locator('button[type="submit"]').click();
        check(await until(async () => emails.some((e) => e.email === 'lea@example.test')), 'people only: the e-mail goes to the people route');
        check(emails.at(-1)?.csrf === 'test-token', 'people only: with the CSRF header');
        check(await until(async () => !(await emailBox.isVisible())), 'people only: the field goes once the e-mail is left');
        check(await until(async () => (await page.locator('aparte-chat-bubble[data-kind="notice"]').count()) === noticesBefore + 1), 'people only: a notice says where the answer goes');

        // A file for the team: the paperclip, a form to the people route, the server's address after.
        const clip = page.locator('#shell-a aparte-composer-add-attachment');
        check(await until(() => clip.isVisible()), 'people only: the visitor can attach a file for the team');
        // The paperclip opens the file dialog, which the browser answers with the file.
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), clip.locator('button').click()]);
        await chooser.setFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
        await send('My order number');
        check(await until(async () => heard.some((h) => h.multipart && h.file && h.content === 'My order number')), 'people only: the file goes to the people route, with the words');
        check(await until(async () => page.evaluate(() => document.querySelector('#shell-a aparte-chat-viewport')?.getMessages?.().some((m) => m.attachments?.some((a) => a.url.endsWith('/files/f1'))))), "people only: the bubble opens the file from the server's address");
        check(problems.length === 0, `people only: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        server_.peopleOnly = false;
        await page.close();
    });

    // ── Files for the model (`files`), whoever answers ─────────────────────────────────────
    /** Attach a PNG with the chat's paperclip (the 1×1 one unless given), without sending. */
    const attach = async (page, scope, buffer = PNG) => {
        const clip = page.locator(`${scope} aparte-composer-add-attachment`);
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), clip.locator('button').click()]);
        await chooser.setFiles({ name: 'dot.png', mimeType: 'image/png', buffer });
    };
    /**
     * A PNG like a phone's photo, drawn in the page: a gradient with the grain of a sensor, which PNG cannot compress
     * (3000×2250 weighs several megabytes, as a photo does).
     */
    const photo = async (page, width, height) => Buffer.from(await page.evaluate(([w, h]) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d');
        const light = context.createLinearGradient(0, 0, w, h);
        light.addColorStop(0, '#5b8bd9');
        light.addColorStop(0.6, '#f2d29b');
        light.addColorStop(1, '#3d6b3a');
        context.fillStyle = light;
        context.fillRect(0, 0, w, h);
        const pixels = context.getImageData(0, 0, w, h);
        for (let i = 0; i < pixels.data.length; i += 4) {
            const grain = (Math.random() - 0.5) * 24;
            pixels.data[i] += grain;
            pixels.data[i + 1] += grain;
            pixels.data[i + 2] += grain;
        }
        context.putImageData(pixels, 0, 0);
        return canvas.toDataURL('image/png').split(',')[1];
    }, [width, height]), 'base64');
    /** Attach a PNG, send `text`, and wait for the run it starts. */
    const attachAndSay = async (page, scope, text, buffer = PNG) => {
        await attach(page, scope, buffer);
        const before = turns.length;
        await page.locator(`${scope} .aparte-ci-editor`).click();
        await page.keyboard.type(text);
        await page.keyboard.press('Enter');
        return until(async () => turns.length > before);
    };

    await scenario('files', async () => {
        const { page, problems } = await open('/files');
        const clip = page.locator('aparte-composer-add-attachment');
        check(await until(() => clip.isVisible()), 'files: the chat has a paperclip, with no team');
        check(await clip.getAttribute('accept') === 'image/*,text/*', 'files: it takes the kinds `files` names');
        check(await attachAndSay(page, 'aparte-chat', 'What is this?'), 'files: the message goes out');
        check(turns.at(-1)?.images === 1, `files: the image goes to the endpoint inside the message (got ${turns.at(-1)?.images})`);

        // aparté shows the file from a blob: address, which dies with the page. What the tab keeps is a small picture.
        const tab = () => page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage).filter((k) => k.startsWith('aparte-laravel')).map((k) => [k, sessionStorage.getItem(k)])));
        check(await until(async () => Object.values(await tab()).some((v) => v.includes('data:image/jpeg'))), 'files: the tab keeps a small picture of the image');
        const stored = await tab();
        check(!Object.values(stored).some((v) => v.includes('blob:')), 'files: and no blob: address, which a later page could not open');
        // Opened again in another browser, with what was kept: the picture, not a broken image.
        const again = await (await browser.newContext()).newPage();
        await again.addInitScript((kept) => { for (const [k, v] of Object.entries(kept)) sessionStorage.setItem(k, v); }, stored);
        await again.goto(`${ORIGIN}/files`);
        const picture = again.locator('aparte-chat-bubble[data-role="user"] img');
        check(await until(async () => (await picture.count()) === 1 && (await picture.evaluate((img) => img.complete && img.naturalWidth > 0 && img.src.startsWith('data:image/jpeg')))), 'files: opened again, the image shows from its picture');
        await again.close();
        check(turns.at(-1)?.imageFacts?.[0]?.type === 'image/png', 'files: a small image goes to the model as it is');

        // Pasted into the field, as the issue tried: the same paperclip takes it.
        const pending = () => page.evaluate(() => document.querySelector('aparte-composer')?.attachments?.length ?? -1);
        await page.locator('aparte-chat .aparte-ci-editor').click();
        await page.evaluate((png) => {
            const bytes = Uint8Array.from(atob(png), (character) => character.charCodeAt(0));
            const clipboard = new DataTransfer();
            clipboard.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
            // A paste event carrying the clipboard, as the browser hands it to the field. Not a constructed
            // ClipboardEvent: Firefox empties the clipboardData of one a script makes.
            const paste = new Event('paste', { bubbles: true, cancelable: true });
            Object.defineProperty(paste, 'clipboardData', { value: clipboard });
            document.querySelector('aparte-chat .aparte-ci-editor').dispatchEvent(paste);
        }, PNG.toString('base64'));
        check(await until(async () => (await pending()) === 1), 'files: an image pasted into the field is attached');
        const beforePaste = turns.length;
        await page.keyboard.type('And the pasted one?');
        await page.keyboard.press('Enter');
        check(await until(async () => turns.length > beforePaste && turns.at(-1).images === 1), 'files: and goes to the model with the message');
        check(turns.at(-1)?.imageFacts?.length === 1, 'files: the earlier image is not sent again: the earlier messages go as their text');

        // A phone's photo: large, and heavy in base64. It goes to the model at 1568 pixels, in a few hundred kilobytes.
        check(await attachAndSay(page, 'aparte-chat', 'A photo from my phone', await photo(page, 3000, 2250)), 'files: a large photo goes out');
        const sent = turns.at(-1)?.imageFacts?.[0];
        check(sent?.type === 'image/jpeg' && Math.max(sent.size?.width ?? 0, sent.size?.height ?? 0) === 1568, `files: scaled to 1568 pixels on its longest side (got ${sent?.type} ${sent?.size?.width}×${sent?.size?.height})`);
        check((sent?.bytes ?? Infinity) < 700_000, `files: in a few hundred kilobytes (${sent?.bytes} bytes; the request ${turns.at(-1)?.bytes})`);
        check(problems.length === 0, `files: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    await scenario('files refused for their size', async () => {
        const { page, problems } = await open('/files-small');
        await page.locator('aparte-composer-add-attachment').waitFor({ timeout: 20_000 });
        await attach(page, 'aparte-chat', await photo(page, 3000, 2250));
        await page.locator('aparte-chat .aparte-ci-editor').click();
        await page.keyboard.type('Too big for this server');
        await page.keyboard.press('Enter');
        check(await until(async () => refused.length > 0), 'files refused: the server answers 413');
        const error = page.locator('aparte-chat .aparte-segment-error');
        check(await until(async () => (await error.count()) > 0), 'files refused: the chat says the message did not go');
        const said = ((await error.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ');
        // aparté's own sentence for a 413 (1.17): what helps, not "Try again in a moment", which would send the same bytes.
        check(said.includes('This message is too large to send') && !said.includes('Try again'), `files refused: and says what helps, with no retry that would fail the same way ("${said.trim().slice(0, 120)}")`);
        check(problems.some((p) => p.includes('client_max_body_size')), 'files refused: the console tells the developer which limit to raise');
        await page.locator('aparte-chat .aparte-ci-editor').click();
        await page.keyboard.type('Still here');
        check(((await page.locator('aparte-chat .aparte-ci-editor').textContent()) ?? '').includes('Still here'), 'files refused: and the person can write again');
        check(!problems.some((p) => p.startsWith('pageerror')), `files refused: no uncaught error${problems.length ? ` (console: ${problems.join(' | ').slice(0, 300)})` : ''}`);
        await page.close();
    });

    await scenario('files kept on the server', async () => {
        const { page, problems } = await open('/files-kept');
        await page.locator('aparte-composer-add-attachment').waitFor({ timeout: 20_000 });
        check(await attachAndSay(page, 'aparte-chat', 'Keep this one'), 'files kept: the message goes out');
        const sent = () => [...kept.values()].find((c) => JSON.stringify(c).includes('Keep this one'));
        check(await until(async () => JSON.stringify(sent() ?? {}).includes('data:image/jpeg')), 'files kept: the server keeps a small picture of the image');
        const body = JSON.stringify(sent() ?? {});
        check(!body.includes('blob:'), 'files kept: and no blob: address');

        // The worst case for a picture's weight: a large photo of pure noise, which a JPEG cannot compress.
        const noise = Buffer.from(await page.evaluate(() => {
            const canvas = document.createElement('canvas');
            canvas.width = 1600;
            canvas.height = 1200;
            const context = canvas.getContext('2d');
            const pixels = context.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < pixels.data.length; i++) pixels.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
            context.putImageData(pixels, 0, 0);
            return canvas.toDataURL('image/png').split(',')[1];
        }), 'base64');
        check(await attachAndSay(page, 'aparte-chat', 'And a noisy photo', noise), 'files kept: a large photo goes out too');
        const pictures = () => JSON.stringify(sent() ?? {}).match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g) ?? [];
        check(await until(async () => new Set(pictures()).size === 2), 'files kept: and its picture is kept');
        const largest = Math.max(...pictures().map((p) => p.length));
        check(largest < 20_000, `files kept: a picture weighs about ten kilobytes at worst (${largest} characters)`);
        const total = JSON.stringify(sent() ?? {}).length;
        check(total < 2_000_000 / 40, `files kept: the conversation with both weighs under a fortieth of the 2 MB the server keeps of one (${total} bytes)`);
        check(problems.length === 0, `files kept: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    await scenario('files with slots', async () => {
        const { page, problems } = await open('/files-slotted');
        const clip = page.locator('aparte-composer-add-attachment');
        check(await until(() => clip.isVisible()), 'files with slots: the composer the view wrote has the paperclip');
        check(await page.locator('aparte-composer .tools').isVisible(), 'files with slots: and the toolbar the view put in it');
        check(await attachAndSay(page, 'aparte-chat', 'And this?'), 'files with slots: the message goes out');
        check(turns.at(-1)?.images === 1, `files with slots: with the image (got ${turns.at(-1)?.images})`);
        // aparté keeps the paperclip in step only in a composer it wrote; the package does it in this one.
        await page.evaluate(() => document.querySelector('aparte-chat').removeAttribute('attachments'));
        check(await until(async () => (await clip.count()) === 0 && (await page.locator('aparte-composer-attachments').count()) === 0), 'files with slots: the paperclip goes with `attachments`');
        await page.evaluate(() => document.querySelector('aparte-chat').setAttribute('attachments', ''));
        check(await until(async () => (await clip.count()) === 1 && (await page.locator('aparte-composer-attachments').count()) === 1), 'files with slots: and comes back with it');
        check(problems.length === 0, `files with slots: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    await scenario('files out of step', async () => {
        const { page, problems } = await open('/files-stale');
        await page.waitForFunction(() => document.querySelector('aparte-chat')?.hasAttribute('data-aparte-mounted'), null, { timeout: 20_000 });
        check(await until(async () => (await page.locator('aparte-composer-add-attachment').count()) === 0 && (await page.locator('aparte-composer-attachments').count()) === 0), 'files out of step: a paperclip the chat does not offer is taken out when it starts');
        check(problems.length === 0, `files out of step: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    await scenario('files and the team', async () => {
        const echo = async (page) => page.addInitScript(() => {
            const listeners = new Map();
            const subscription = (name) => ({
                listen(event, fn) { listeners.set(`${name}${event}`, fn); return this; },
                stopListening(event) { listeners.delete(`${name}${event}`); return this; },
            });
            window.Echo = { private: (name) => subscription(`private:${name}`), channel: (name) => subscription(name), leave: () => {} };
            window.desk = (id, change) => listeners.get(`aparte.conversations.${id}.secret.aparte.changed`)?.(change);
            window.listening = (id) => listeners.has(`aparte.conversations.${id}.secret.aparte.changed`);
        });
        const { page, problems } = await open('/files-people', echo);
        const clip = page.locator('#shell-a aparte-composer-add-attachment');
        check(await until(async () => (await clip.getAttribute('accept')) === 'image/*'), "files and the team: while the assistant answers, the paperclip takes the model's kinds");
        check(await attachAndSay(page, '#shell-a', 'Here is a photo'), 'files and the team: the message goes out');
        check(turns.at(-1)?.images === 1, `files and the team: the image goes to the assistant (got ${turns.at(-1)?.images})`);
        const id = turns.at(-1).threadId;
        check(await until(() => page.evaluate((i) => window.listening(i), id)), "files and the team: the chat listens on the conversation's channel");
        // An image picked for the model, not sent yet, when the team takes over: dropped, or it would go to the team.
        await attach(page, '#shell-a');
        const pending = () => page.evaluate(() => document.querySelector('#shell-a aparte-composer')?.attachments?.length ?? -1);
        check(await until(async () => (await pending()) === 1), 'files and the team: an image waits to be sent');
        await page.evaluate(([i]) => window.desk(i, { type: 'auto-reply', on: false }), [id]);
        check(await until(async () => (await clip.getAttribute('accept')) === '.png,.txt,.pdf'), "files and the team: handed over, it takes the team's kinds");
        check(await until(async () => (await pending()) === 0), 'files and the team: and the image picked for the model is dropped');
        await page.evaluate(([i]) => window.desk(i, { type: 'auto-reply', on: true }), [id]);
        check(await until(async () => (await clip.getAttribute('accept')) === 'image/*'), "files and the team: handed back, the model's again");
        check(problems.length === 0, `files and the team: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── The model's memory follows the branch on screen (ShownBranchStore) ───────────────────
    await scenario('memory', async () => {
        const { page, problems } = await open('/memory');
        const one = chatOf(page, 'body');
        const onScreen = () => page.evaluate(() => document.querySelector('aparte-chat-viewport').getMessages().map((m) => m.id));
        const settled = (before) => until(async () => turns.length > before && (await page.locator('aparte-chat .aparte-message-streaming').count()) === 0, 20_000);
        const named = () => turns.at(-1)?.shown ?? { shown: [] };
        const action = async (bubble, name) => {
            await bubble.hover();
            await bubble.locator(`[data-action="${name}"]`).click();
        };

        check(await one.say('First'), 'memory: the first answer comes');
        const [u1, a1] = await onScreen();
        check(named().reply === a1 && named().shown.includes(u1), 'memory: the request names the messages on screen and the one its answer is drawn in');
        check(named().asked === u1 && named().text === 'First', 'memory: and the message it answers, with its text');

        check(await one.say('Second'), 'memory: the second answer comes');
        const [, , u2, a2] = await onScreen();
        check(named().reply === a2 && [u1, a1, u2].every((id) => named().shown.includes(id)), 'memory: going on, the request names the whole branch');

        let before = turns.length;
        await action(page.locator('aparte-chat-bubble[data-role="assistant"]').last(), 'retry');
        check(await settled(before), 'memory: a retry is answered');
        const a2b = (await onScreen()).at(-1);
        check(a2b !== a2 && named().reply === a2b, 'memory: a retry draws its answer in a new message, and names it');
        check(!named().shown.includes(a2) && [u1, a1, u2].every((id) => named().shown.includes(id)), 'memory: the answer it replaces is not named, the rest of the branch is');
        check(named().asked === u2 && named().text === 'Second', 'memory: a retry asks the same message again, with the same text');

        // Back to the first version of the answer (‹1/2›), and on from there.
        await page.locator('aparte-chat-bubble[data-role="assistant"]').last().locator('.aparte-branch-prev').click();
        check(await until(async () => (await onScreen())[3] === a2), 'memory: the person goes back to the first answer');
        check(await one.say('Third'), 'memory: and goes on from there');
        const [, , , , u3, a3] = await onScreen();
        check(named().shown.includes(a2) && !named().shown.includes(a2b), 'memory: the request names that answer, not the one it went back from');

        // An edit changes the message in place (aparté keeps its id) and drops every answer after it.
        before = turns.length;
        const second = page.locator('aparte-chat-bubble[data-role="user"]').nth(1);
        await action(second, 'edit');
        await second.locator('aparte-composer-input').evaluate((input) => input.setValue('Second, edited'));
        await second.locator('[data-action="edit-save"]').click();
        check(await settled(before), 'memory: an edit is answered');
        const a2c = (await onScreen()).at(-1);
        check(named().reply === a2c && named().shown.includes(u2) && ![a2, a2b, u3, a3].some((id) => named().shown.includes(id)), 'memory: an edit names its new answer, and nothing it replaced');
        check(named().asked === u2 && named().text === 'Second, edited', 'memory: it asks the same message, with its new text');
        check(problems.length === 0, `memory: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── The model the person chooses (`:models="true"`) ──────────────────────────────────────
    await scenario('models', async () => {
        const { page, problems } = await open('/models');
        const one = chatOf(page, 'body');
        const trigger = page.locator('aparte-select[data-aparte-model] .aparte-select-trigger');
        check(await until(() => trigger.isVisible()), 'models: the list of models is under the message field');
        check((await trigger.textContent()).includes('Claude Sonnet'), 'models: the first is chosen');
        check(await trigger.getAttribute('aria-label') === 'Model', 'models: and the list is named');
        check(await one.say('Hello'), 'models: the message goes out');
        check(turns.at(-1)?.model === 'anthropic:claude-sonnet-5-5', `models: with the model chosen (got ${turns.at(-1)?.model})`);
        await trigger.click();
        await page.locator('aparte-option[value="anthropic:claude-haiku-5-5"]').click();
        check(await until(async () => (await trigger.textContent()).includes('Claude Haiku')), 'models: the person chooses another');
        check(await one.say('And now?'), 'models: the next message goes out');
        check(turns.at(-1)?.model === 'anthropic:claude-haiku-5-5', `models: with the model now chosen (got ${turns.at(-1)?.model})`);
        await page.reload();
        await page.waitForFunction(() => document.querySelector('aparte-chat')?.hasAttribute('data-aparte-mounted'), null, { timeout: 20_000 });
        check(await until(async () => (await trigger.textContent()).includes('Claude Haiku')), 'models: on the next visit, the last one chosen');
        check(await one.say('Again'), 'models: a message after the visit goes out');
        check(turns.at(-1)?.model === 'anthropic:claude-haiku-5-5', `models: with that model (got ${turns.at(-1)?.model})`);
        check(problems.length === 0, `models: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });
} finally {
    await browser.close();
    server.close();
}
process.exit(failed ? 1 : 0);
