// The built chat (dist/aparte.js and .css) in Chromium, as the Blade components put it on a page: the chat mounts,
// a message goes out once with the CSRF header, and the AG-UI reply streams in as Markdown. A new aparté that
// breaks the package's script fails here, before anyone installs it.
//
// Then what an app puts around the chat, as an app using a framework wrapper can: a list of conversations written
// in the view, two chats that each keep their own, and a storage and a runner of the app's in place of the package's.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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

/** Where the five routes a view names with `conversations="…"` are, on this server. */
const API = '/kept/conversations';
/** What a server keeps for the person signed in, behind those routes. */
const kept = new Map();
/** Every request those routes received: the method, the id, the CSRF header. */
const calls = [];

const pages = {
    '/': `${head}${chat('aparte-chat-1', `${ORIGIN}/chat`)}</body></html>`,
    // Tall enough for a row's menu to open inside the sidebar.
    '/conversations': `${head}${shell('shell-a', 'aparte-chat-1', 580)}</body></html>`,
    // The same view, its conversations kept by the server.
    '/kept': `${head}${shell('shell-a', 'aparte-chat-1', 580, `data-aparte-conversations="${ORIGIN}/kept/conversations"`)}</body></html>`,
    // A server that does not answer for them.
    '/kept-broken': `${head}${shell('shell-a', 'aparte-chat-1', 580, `data-aparte-conversations="${ORIGIN}/broken"`)}</body></html>`,
    '/two-chats': `${head}${shell('shell-a', 'aparte-chat-1')}${shell('shell-b', 'aparte-chat-2')}</body></html>`,
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
};

const server = createServer((req, res) => {
    if (req.method === 'POST' && (req.url === '/chat' || req.url === '/turns')) {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            const input = JSON.parse(body);
            const event = (data) => `data: ${JSON.stringify(data)}\n\n`;
            const deltas = req.url === '/chat' ? ['**Hello** from ', 'the built chat'] : [`Reply ${turns.length + 1}`];
            (req.url === '/chat' ? posts : turns).push({ csrf: req.headers['x-csrf-token'], threadId: input.threadId });
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.end(
                event({ type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId })
                + event({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' })
                + deltas.map((delta) => event({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta })).join('')
                + event({ type: 'TEXT_MESSAGE_END', messageId: 'm1' })
                + event({ type: 'RUN_FINISHED', threadId: input.threadId, runId: input.runId }),
            );
        });
        return;
    }
    if (req.url.startsWith('/broken')) {
        res.writeHead(500);
        return res.end();
    }
    // The five routes, as the package's controller answers them.
    if (req.url === API || req.url.startsWith(`${API}/`)) {
        const id = decodeURIComponent(req.url.slice(API.length + 1));
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            calls.push({ method: req.method, id, csrf: req.headers['x-csrf-token'] });
            const json = (status, data) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(data === undefined ? '' : JSON.stringify(data));
            };
            if (req.url === API) {
                const list = [...kept.values()].sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(({ messages, tree, autoTitle, ...meta }) => meta);
                return json(200, { conversations: list });
            }
            if (req.method === 'PUT') {
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

const browser = await chromium.launch();
/** A page of the server, with what its console complained about. */
const open = async (path) => {
    const page = await browser.newPage();
    const problems = [];
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
        check(posts.length === 1, `one request for one message (got ${posts.length})`);
        check(posts[0]?.csrf === 'test-token', 'the CSRF header is sent');
        check(typeof posts[0]?.threadId === 'string' && posts[0].threadId.length > 0, 'the request names its thread');
        check(problems.length === 0, `no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
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
        const saved = [...kept.values()][0];
        check(saved?.title === 'First question' && saved?.messages?.length === 2, 'kept: with its title and what is on screen');
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

        await b.rows.filter({ hasText: 'Second question' }).locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="rename"]').click();
        const input = page.locator('.aparte-conv-item__input');
        await input.fill('Leave');
        await input.press('Enter');
        check(await until(async () => [...kept.values()].some((conversation) => conversation.title === 'Leave')), 'kept: a rename reaches the server');
        check(calls.some((call) => call.method === 'PATCH'), 'kept: without its messages travelling');

        await b.rows.filter({ hasText: 'Leave' }).locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="delete"]').click();
        await page.locator('[data-menu-action="confirm-delete"]').click();
        check(await until(async () => kept.size === 1 && [...kept.values()][0].title === 'First question'), 'kept: a delete reaches the server');
        check(problems.length === 0, `kept: no console error or warning on the second page${problems.length ? `: ${problems.join(' | ')}` : ''}`);
        await page.close();
    });

    // ── A server that does not answer for the conversations ────────────────────────────────
    await scenario('broken', async () => {
        const { page, problems } = await open('/kept-broken');
        const a = chatOf(page, '#shell-a');
        check(await a.say('Still here?'), 'broken: the chat still answers');
        check(problems.some((problem) => problem.includes('keeps them for the tab')), 'broken: the console says the conversations stay in the tab');
        check(await until(async () => (await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('aparte-laravel:')).length)) === 1), 'broken: and that is where they are');
        await page.close();
    });
} finally {
    await browser.close();
    server.close();
}
process.exit(failed ? 1 : 0);
