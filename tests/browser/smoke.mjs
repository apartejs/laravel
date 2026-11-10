// The built chat (dist/aparte.js and .css) in Chromium, as the Blade components put it on a page: the chat mounts,
// a message goes out once with the CSRF header, and the AG-UI reply streams in as Markdown. A new aparté that
// breaks the package's script fails here, before anyone installs it.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const PORT = 5298;
const posts = [];

const page_ = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Smoke</title></head>
<body style="height: 600px">
<link rel="stylesheet" href="/aparte.css">
<script type="module" src="/aparte.js"></script>
<aparte-chat id="aparte-chat-1" data-aparte-endpoint="http://127.0.0.1:${PORT}/chat" data-aparte-csrf="test-token" data-aparte-scope="" style="height: 100%"></aparte-chat>
</body></html>`;

const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/chat') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
            const input = JSON.parse(body);
            posts.push({ csrf: req.headers['x-csrf-token'], threadId: input.threadId });
            const event = (data) => `data: ${JSON.stringify(data)}\n\n`;
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.end(
                event({ type: 'RUN_STARTED', threadId: input.threadId, runId: input.runId })
                + event({ type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' })
                + event({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: '**Hello** from ' })
                + event({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'the built chat' })
                + event({ type: 'TEXT_MESSAGE_END', messageId: 'm1' })
                + event({ type: 'RUN_FINISHED', threadId: input.threadId, runId: input.runId }),
            );
        });
        return;
    }
    const file = { '/aparte.js': ['aparte.js', 'text/javascript'], '/aparte.css': ['aparte.css', 'text/css'] }[req.url];
    if (file) {
        res.writeHead(200, { 'Content-Type': file[1] });
        return res.end(readFileSync(dist + file[0]));
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(page_);
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

let failed = false;
const check = (ok, label) => {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
    if (!ok) failed = true;
};

const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    await page.goto(`http://127.0.0.1:${PORT}/`);

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
} finally {
    await browser.close();
    server.close();
}
process.exit(failed ? 1 : 0);
