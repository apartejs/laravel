// What Vite mode promises, read from the build: the package's script is in what Composer installs, and the
// app's plugins and the chat share ONE copy of aparté (two copies would leave every plugin silently unseen).
import { existsSync, readdirSync, readFileSync } from 'node:fs';

let failed = false;
const check = (ok, label) => {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
    if (!ok) failed = true;
};

check(existsSync('vendor/apartejs/laravel/resources/js/aparte.js'), 'resources/js/aparte.js is in what Composer installs');
check(existsSync('vendor/apartejs/laravel/resources/js/aparte.d.ts'), 'so are its types');

const js = readdirSync('dist/assets').filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(`dist/assets/${file}`, 'utf8')).join('\n');
const copies = (js.match(/define\("aparte-chat-viewport"/g) ?? []).length;
check(copies === 1, `one copy of aparté in the build (found ${copies})`);
check(/katex/i.test(js), 'the plugin is in the build');

process.exit(failed ? 1 : 0);
