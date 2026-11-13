// The chat in Chromium against a real Laravel app (`testbench.yaml` and `workbench/`): the package's own routes and
// views, a session, the CSRF check, the Laravel AI SDK's tables and the package's, in one database, and a Filament
// panel with the package's plugin. What `smoke.mjs` shows with a server that imitates the controller, this shows
// with the controller.
//
//   vendor/bin/testbench workbench:build && vendor/bin/testbench serve --port=8000
//   APP_URL=http://127.0.0.1:8000 node app.mjs
import { chromium } from 'playwright';

const APP = (process.env.APP_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
const REPLY = 'A reply from the Laravel app.';

let failed = false;
const check = (ok, label) => {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
    if (!ok) failed = true;
};
/** True as soon as `probe` is, false once `ms` have passed. */
const until = async (probe, ms = 20_000) => {
    const end = Date.now() + ms;
    for (;;) {
        if (await probe().catch(() => false)) return true;
        if (Date.now() > end) return false;
        await new Promise((resolve) => setTimeout(resolve, 100));
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

// The app may still be starting: wait for it to answer before opening a browser on it.
if (!(await until(async () => (await fetch(`${APP}/`)).ok, 90_000))) {
    console.log(`FAIL no app answers at ${APP}`);
    process.exit(1);
}

const browser = await chromium.launch();
/** A browser of its own (cookies, storage), signed in as `person` when given, on `path`. */
const visit = async (person, path = '/') => {
    const context = await browser.newContext();
    // Signed in with a request, not a page: a page left while its chat was loading would
    // report the requests the browser cancelled.
    if (person) await context.request.get(`${APP}/sign-in/${person}`);
    const page = await context.newPage();
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await page.goto(`${APP}${path}`);
    return { page, problems };
};
/** Load the page again, once it has nothing left in flight (a reload would cancel it). */
const reload = async (page) => {
    await page.waitForLoadState('networkidle');
    await page.reload();
};
/** What the database holds for whoever the page is signed in as. */
const state = (page) => page.evaluate(async () => (await fetch('/state', { headers: { Accept: 'application/json' } })).json());
/** The chat of a page: say something, read what it shows. */
const chatOf = (page) => {
    const editor = page.locator('aparte-chat .aparte-ci-editor');
    const replies = page.locator('aparte-chat aparte-chat-bubble[data-role="assistant"]');
    return {
        rows: page.locator('aparte-conversation-list [data-conv-id]'),
        title: page.locator('[data-aparte-title]'),
        transcript: async () => (await page.locator('aparte-chat aparte-chat-viewport').textContent()) ?? '',
        /** Send `text` and wait for a new reply to be whole. */
        async say(text) {
            await editor.waitFor({ state: 'visible', timeout: 30_000 });
            const before = await replies.count();
            await editor.click();
            await page.keyboard.type(text);
            await page.keyboard.press('Enter');
            return until(async () => (await replies.count()) > before && (await page.locator('aparte-chat .aparte-message-streaming').count()) === 0, 40_000);
        },
    };
};
/** The list has what the server gave it: a count read before that says nothing. */
const listed = (page) => until(async () => page.evaluate(() => {
    const chat = document.querySelector('aparte-chat');
    const list = document.querySelector('aparte-conversation-list');
    return chat?.hasAttribute('data-aparte-mounted') && list && !list.hasAttribute('loading');
}));
const noProblem = (name, problems) => check(problems.length === 0, `${name}: no console error or warning${problems.length ? `: ${problems.join(' | ')}` : ''}`);

try {
    let firstId = '';

    await scenario('guest', async () => {
        const { page, problems } = await visit(null);
        await page.locator('aparte-chat').waitFor({ state: 'attached', timeout: 30_000 });
        check(!(await page.locator('aparte-chat').getAttribute('data-aparte-conversations')), 'guest: the chat of someone not signed in keeps its conversations for the tab');
        check((await page.evaluate(async () => (await fetch('/chat/conversations', { headers: { Accept: 'application/json' } })).status)) === 401, 'guest: and the routes answer 401');
        noProblem('guest', problems.filter((problem) => !problem.includes('401')));
        await page.context().close();
    });

    await scenario('kept', async () => {
        const { page, problems } = await visit(1);
        const chat = chatOf(page);
        check(await chat.say('First question'), 'kept: the Laravel agent answers');
        check((await chat.transcript()).includes(REPLY), 'kept: with its own words');
        check(await until(async () => (await chat.rows.count()) === 1), 'kept: the list shows the conversation');
        check(await until(async () => { const s = await state(page); return s.kept === 1 && s.memory === 1; }), 'kept: the database holds it once for the list, once for the model');
        firstId = (await chat.rows.first().getAttribute('data-conv-id')) ?? '';
        check((await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('aparte-laravel:')).length)) === 0, 'kept: and the tab holds nothing');
        // A request that is not the page's: the person's cookies, but neither the token nor the origin a
        // browser sends with a page's own request. Laravel 12 asks for the token and Laravel 13 for either.
        const forged = await page.context().request.put(`${APP}/chat/conversations/${firstId}`, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            data: '{}',
        });
        check(forged.status() === 419, `kept: a forged save is refused by Laravel (answered ${forged.status()})`);
        noProblem('kept', problems);
        await page.context().close();
    });

    await scenario('again', async () => {
        const { page, problems } = await visit(1);
        const chat = chatOf(page);
        check(await until(async () => (await chat.rows.count()) === 1), 'again: another browser, signed in as the same person, lists it');
        check(await until(async () => { const text = await chat.transcript(); return text.includes('First question') && text.includes(REPLY); }), 'again: and opens it with its question and its reply');
        check(await until(async () => (await chat.title.textContent()) === 'First question'), 'again: under its name');

        await chat.rows.first().locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="rename"]').click();
        await page.locator('.aparte-conv-item__input').fill('Leave');
        await page.locator('.aparte-conv-item__input').press('Enter');
        await until(async () => (await chat.rows.first().textContent())?.includes('Leave'));
        await reload(page);
        check(await until(async () => ((await chatOf(page).rows.first().textContent()) ?? '').includes('Leave')), 'again: a rename is still there after a reload');
        noProblem('again', problems);
        await page.context().close();
    });

    await scenario('theirs', async () => {
        const { page, problems } = await visit(2);
        const chat = chatOf(page);
        await page.locator('aparte-chat .aparte-ci-editor').waitFor({ state: 'visible', timeout: 30_000 });
        check((await listed(page)) && (await chat.rows.count()) === 0, 'theirs: someone else sees none of it');
        check((await page.evaluate(async (id) => (await fetch(`/chat/conversations/${id}`, { headers: { Accept: 'application/json' } })).status, firstId)) === 404, 'theirs: and cannot read it by its id');
        noProblem('theirs', problems.filter((problem) => !problem.includes('404')));
        await page.context().close();
    });

    await scenario('floating', async () => {
        const { page, problems } = await visit(1, '/floating');
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
        const chat = chatOf(page);
        check(await until(async () => (await chat.transcript()).includes('First question')), 'floating: the floating chat opens on the conversation that was kept');
        await page.locator('.aparte-app-header [data-aparte-new-chat]').click();
        await until(async () => !(await chat.transcript()).includes('First question'));
        check(await chat.say('Second question'), 'floating: a new conversation is answered');
        check(await until(async () => (await state(page)).kept === 2), 'floating: and kept');

        await page.locator('[data-aparte-sidebar-toggle]').click();
        check(await until(async () => { const s = await sidebar(); return s.drawer && !s.closed && s.wide && s.inCard; }), 'floating: the list opens inside the card');
        check((await chat.rows.count()) === 2, 'floating: with both conversations');

        // A row's menu is placed against the window: it must stand at its row.
        const row = chat.rows.filter({ hasText: 'Leave' });
        await row.hover();
        await row.locator('.aparte-conv-item__more').click();
        const menu = page.locator('[role="menu"]');
        await menu.waitFor({ state: 'visible' });
        const more = await row.locator('.aparte-conv-item__more').boundingBox();
        const drawn = await menu.boundingBox();
        check(Math.abs(drawn.y - (more.y + more.height)) < 16 || Math.abs(drawn.y + drawn.height - more.y) < 16, "floating: a row's menu opens at its row");
        await page.keyboard.press('Escape');
        await until(async () => !(await menu.isVisible().catch(() => false)));
        check(!(await sidebar()).closed, 'floating: Escape closes that menu and leaves the list open');
        await page.keyboard.press('Escape');
        check(await until(async () => (await sidebar()).closed), 'floating: Escape again closes the list');
        check(await page.locator('aparte-launcher').evaluate((el) => el.hasAttribute('open')), 'floating: and leaves the chat open');
        await page.locator('[data-aparte-sidebar-toggle]').click();
        await until(async () => !(await sidebar()).closed);

        await chat.rows.filter({ hasText: 'Leave' }).locator('.aparte-conv-item__select').click();
        check(await until(async () => (await sidebar()).closed && (await chat.transcript()).includes('First question')), 'floating: choosing one closes the list and opens it');

        await page.locator('[data-aparte-launcher-maximize]').click();
        check(await until(async () => { const s = await sidebar(); return !s.drawer && !s.closed && s.wide; }), 'floating: maximized, the list is a column beside the chat');
        noProblem('floating', problems);
        await page.context().close();
    });

    await scenario('deleted', async () => {
        const { page, problems } = await visit(1);
        const chat = chatOf(page);
        check(await until(async () => (await chat.rows.count()) === 2), 'deleted: both conversations are listed');
        await chat.rows.filter({ hasText: 'Second question' }).locator('.aparte-conv-item__more').click();
        await page.locator('[role="menu"] [data-menu-action="delete"]').click();
        await page.locator('[data-menu-action="confirm-delete"]').click();
        check(await until(async () => { const s = await state(page); return s.kept === 1 && s.memory === 1; }), "deleted: a delete removes the conversation and the model's memory of it");
        await reload(page);
        check(await until(async () => (await chatOf(page).rows.count()) === 1), 'deleted: and it is gone after a reload');
        noProblem('deleted', problems);
        await page.context().close();
    });
    // What `ApartePlugin::make()->conversations()` gives someone signed in to a Filament panel, in SPA mode.
    await scenario('panel', async () => {
        const { page, problems } = await visit(1, '/admin');
        const sends = [];
        page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/admin/aparte-chat')) sends.push(request.url()); });
        const button = page.locator('aparte-launcher .aparte-launcher__button');
        const opened = async () => { if ((await page.locator('aparte-launcher').getAttribute('open')) === null) await button.click(); };
        const titles = (url) => page.evaluate(async (address) => (await (await fetch(address, { headers: { Accept: 'application/json' } })).json()).conversations.map((c) => c.title), url);
        check(page.url().endsWith('/admin'), `panel: someone signed in reaches the panel (${page.url()})`);
        check(await until(async () => (await button.count()) === 1 && (await button.isVisible())), 'panel: the chat floats on its page, one button');

        await opened();
        const chat = chatOf(page);
        check(await chat.say('From the panel'), 'panel: the agent answers');
        check(sends.length === 1, `panel: one request for one message (${sends.length})`);
        check(await until(async () => (await titles('/admin/aparte-chat/conversations')).includes('From the panel')), "panel: the conversation is kept behind the panel's own routes");
        check(!(await titles('/chat/conversations')).includes('From the panel'), "panel: in a list of the panel's own, not the list of the app's other chat");

        await page.locator('aparte-launcher [data-aparte-sidebar-toggle]').click();
        check(await until(async () => (await chat.rows.count()) === 1), 'panel: the list opens in the card, with the conversation');
        await page.keyboard.press('Escape');
        check(await until(async () => page.evaluate(() => document.querySelector('aparte-launcher aparte-sidebar').hasAttribute('collapsed'))), 'panel: Escape closes the list');
        check(await page.locator('aparte-launcher').evaluate((el) => el.hasAttribute('open')), 'panel: and leaves the chat open');

        // Another page of the panel, swapped in by wire:navigate: the chat's script is not loaded again.
        await page.waitForLoadState('networkidle');
        await page.locator('a[href$="/admin/notes"]').first().click();
        check(await until(async () => page.url().endsWith('/admin/notes') && (await page.locator('#notes-body').count()) === 1), 'panel: another page of the panel opens');
        check(await until(async () => (await button.count()) === 1 && (await button.isVisible())), 'panel: with the chat on it, one button');
        await opened();
        check(await until(async () => (await chat.transcript()).includes('From the panel')), 'panel: which opens on the conversation that was kept');
        const before = sends.length;
        check(await chat.say('From another page'), 'panel: and answers there');
        await new Promise((resolve) => setTimeout(resolve, 800));
        check(sends.length === before + 1, `panel: once, not once more for the page that was left (${sends.length - before})`);

        await page.goBack();
        check(await until(async () => page.url().endsWith('/admin') && (await button.count()) === 1), 'panel: Back brings the first page, with one chat');
        await opened();
        const again = sends.length;
        check(await chat.say('Back on the first page'), 'panel: which still answers');
        await new Promise((resolve) => setTimeout(resolve, 800));
        check(sends.length === again + 1, `panel: once (${sends.length - again})`);
        noProblem('panel', problems);
        await page.context().close();
    });

    await scenario('panel, signed out', async () => {
        const { page } = await visit(null, '/admin');
        check(page.url().includes('/admin/login'), 'panel: someone not signed in is sent to its sign-in page');
        check((await page.locator('aparte-launcher').count()) === 0, 'panel: where there is no chat');
        await page.context().close();
    });
} finally {
    await browser.close();
}
process.exit(failed ? 1 : 0);
