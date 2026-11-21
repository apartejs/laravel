import '@aparte/core/styles.css';
import '../css/aparte.css';
import {
    AparteClient,
    AparteConfig,
    AparteConversationController,
    AparteConversationManager,
    attachConfig,
    uuid,
} from '@aparte/core';
import { createAgUiRunner } from '@aparte/runner-ag-ui';
import { setupMarkedStreamingProvider } from '@aparte/plugin-marked/streaming';

/**
 * What is on screen, for this tab only: a reload brings the conversation and a pending
 * approval back, and closing the tab starts over. The model's memory stays on the server.
 */
class TabStorage {
    constructor(key) {
        this.key = key;
    }

    read() {
        try {
            return JSON.parse(sessionStorage.getItem(this.key) ?? '[]');
        } catch {
            return [];
        }
    }

    write(conversations) {
        try {
            sessionStorage.setItem(this.key, JSON.stringify(conversations));
        } catch {
            // Full or blocked: the chat goes on, it just will not survive a reload.
        }
    }

    async loadAll() {
        return this.read();
    }

    async save(conversation) {
        const all = this.read();
        const index = all.findIndex((c) => c.id === conversation.id);
        if (index >= 0) all[index] = conversation;
        else all.push(conversation);
        this.write(all);
    }

    async delete(id) {
        this.write(this.read().filter((c) => c.id !== id));
    }
}

/** What the server answered instead of what was asked: its status, 0 when it was not reached. */
class StorageError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'StorageError';
        this.status = status;
    }
}

/** The server is down, busy or out of reach: the same request, later, may pass. */
const unreachable = (error) => error instanceof StorageError && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);
/** Nobody is signed in any more, or the page's token is stale: it passes once someone signs in again. */
const signedOut = (error) => error instanceof StorageError && (error.status === 401 || error.status === 419);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the list shows of a conversation: everything but what was said in it. */
function rowOf({ messages, tree, ...row }) {
    return row;
}

/**
 * What is on screen, kept by a server for the person signed in: five routes on one address.
 * The list at `url` (no messages in it), and one conversation at `url/{id}`: GET reads it, PUT
 * saves it, PATCH changes its title, pin or archive date, DELETE forgets it. Any server that
 * answers those routes will do.
 *
 * A save never fails for the chat: aparté's manager does not ask twice, so a conversation the
 * server did not take is kept here and sent again (at the next save, when the network or the
 * page comes back, and at longer and longer intervals), until the server has it or refuses it
 * for what it is. `onProblem` is told what is not kept, and why.
 */
class ServerStorage {
    constructor(url, { csrf = '', onProblem = () => {} } = {}) {
        this.url = url.replace(/\/+$/, '');
        this.csrf = csrf;
        this.onProblem = onProblem;
        /** The latest state of each conversation the server does not have yet. */
        this.unsent = new Map();
        this.sending = null;
        this.reload = null;
        this.timer = null;
        this.delay = 0;
        this.told = new Set();
        this.stopped = false;
        this.catchUp = this.catchUp.bind(this);
        this.onVisible = () => {
            if (document.visibilityState === 'visible') void this.catchUp();
        };
        window.addEventListener('online', this.catchUp);
        document.addEventListener('visibilitychange', this.onVisible);
    }

    /** Stop sending and listening: the page is being left. */
    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        window.removeEventListener('online', this.catchUp);
        document.removeEventListener('visibilitychange', this.onVisible);
    }

    /**
     * Laravel's token against forged requests, as it stands now: the cookie it sends again
     * with every answer when there is one, else the token the page was drawn with, which goes
     * stale when the session changes hands.
     */
    token() {
        const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
        return cookie
            ? { 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) }
            : { 'X-CSRF-TOKEN': this.csrf };
    }

    async request(method, id, body) {
        const url = id === undefined ? this.url : `${this.url}/${encodeURIComponent(id)}`;
        let response;
        try {
            response = await fetch(url, {
                method,
                credentials: 'same-origin',
                // A redirect is to a sign-in page, not to a conversation: it is not followed.
                redirect: 'manual',
                headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...this.token() },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
        } catch {
            throw new StorageError(`aparté: ${method} ${url} did not reach the server.`, 0);
        }
        if (response.type === 'opaqueredirect') {
            throw new StorageError(`aparté: the server redirected ${method} ${url}, as it does when nobody is signed in.`, 401);
        }
        if (!response.ok) {
            throw new StorageError(`aparté: the server answered ${response.status} to ${method} ${url}.`, response.status);
        }
        return response;
    }

    /** Tell, once for each thing that went wrong, what is not kept. */
    problem(reason, error, conversationId) {
        const key = `${reason}:${conversationId ?? ''}`;
        if (this.told.has(key)) return;
        this.told.add(key);
        console.warn(`aparté: ${reason === 'gone' ? 'a conversation is no longer on the server' : 'the conversations are not being kept'} (${reason}).`, error);
        this.onProblem({ reason, status: error?.status ?? 0, ...(conversationId ? { conversationId } : {}) });
    }

    async loadMeta() {
        // A server restarting, a network that blinks: asked again before the page is told there is no list.
        for (let attempt = 0; ; attempt++) {
            try {
                const rows = (await (await this.request('GET')).json()).conversations ?? [];
                // What the server does not have yet is still the person's: a list read again must not forget it.
                const known = new Set(rows.map((row) => row.id));
                return [...[...this.unsent.values()].filter((c) => !known.has(c.id)).map(rowOf), ...rows];
            } catch (error) {
                if (attempt === 2 || !unreachable(error)) throw error;
                await wait(400 * 3 ** attempt);
            }
        }
    }

    async loadFull(id) {
        if (this.unsent.has(id)) return this.unsent.get(id);
        try {
            return await (await this.request('GET', id)).json();
        } catch (error) {
            // Deleted from another tab, or another device: an answer, not a failure.
            if (error instanceof StorageError && error.status === 404) {
                this.problem('gone', error, id);
                return null;
            }
            throw error;
        }
    }

    async loadAll() {
        const list = await this.loadMeta();
        return (await Promise.all(list.map(({ id }) => this.loadFull(id)))).filter(Boolean);
    }

    async save(conversation) {
        this.unsent.set(conversation.id, conversation);
        await this.flush();
    }

    /**
     * Send what the server does not have: one conversation at a time and never two requests
     * at once, so an older state never lands after a newer one.
     */
    flush() {
        this.sending ??= (async () => {
            try {
                while (this.unsent.size > 0 && !this.stopped) {
                    const [id, conversation] = this.unsent.entries().next().value;
                    try {
                        await this.request('PUT', id, conversation);
                    } catch (error) {
                        if (unreachable(error)) {
                            this.problem('unreachable', error);
                            this.later();
                            return;
                        }
                        if (signedOut(error)) {
                            // Kept for when someone is signed in again: asked again when the page comes back.
                            this.problem('signed-out', error);
                            return;
                        }
                        // Refused for what it is (too large, not a conversation): the same bytes would be again.
                        if (this.unsent.get(id) === conversation) this.unsent.delete(id);
                        this.problem(error?.status === 413 ? 'too-large' : 'refused', error, id);
                        continue;
                    }
                    // Unless a newer state arrived while this one travelled.
                    if (this.unsent.get(id) === conversation) this.unsent.delete(id);
                }
                // Everything is kept: what went wrong is over, and may be told again if it comes back.
                if (this.unsent.size === 0) {
                    this.delay = 0;
                    this.told.clear();
                }
            } finally {
                this.sending = null;
            }
        })();
        return this.sending;
    }

    /** Ask the server again later, at longer and longer intervals. */
    later() {
        if (this.timer || this.stopped) return;
        this.delay = Math.min((this.delay || 1000) * 2, 60_000);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.catchUp();
        }, this.delay);
    }

    /** The list could not be read when the chat started: read it (`reload`) once the server answers. */
    whenBack(reload) {
        this.reload = reload;
        this.later();
    }

    /** What is still owed: the conversations not sent, then the list not read. */
    async catchUp() {
        if (this.stopped) return;
        await this.flush();
        if (this.unsent.size > 0 || !this.reload) return;
        const reload = this.reload;
        try {
            await reload();
            if (this.reload === reload) this.reload = null;
            this.delay = 0;
        } catch {
            this.later();
        }
    }

    async delete(id) {
        this.unsent.delete(id);
        try {
            await this.request('DELETE', id);
        } catch (error) {
            // Already gone is gone.
            if (!(error instanceof StorageError && error.status === 404)) throw error;
        }
    }

    /** A title, a pin or an archive date, without the messages travelling. */
    async change(id, changes) {
        const unsent = this.unsent.get(id);
        if (unsent) {
            // The server does not have this state of the conversation yet: the change travels with it.
            const next = { ...unsent };
            for (const [field, value] of Object.entries(changes)) {
                if (value === null) delete next[field];
                else next[field] = value;
            }
            if ('title' in changes) next.autoTitle = false;
            this.unsent.set(id, next);
            await this.flush();
            return;
        }
        await this.request('PATCH', id, changes);
    }

    rename(id, title) {
        return this.change(id, { title });
    }

    pin(id) {
        return this.change(id, { pinnedAt: Date.now() });
    }

    unpin(id) {
        return this.change(id, { pinnedAt: null });
    }

    archive(id) {
        return this.change(id, { archivedAt: Date.now() });
    }

    unarchive(id) {
        return this.change(id, { archivedAt: null });
    }
}

/** The runner sends a refusal's yes or no; the words a person typed with it go along here. */
function withInstructions(init, outcomes) {
    if (typeof init?.body !== 'string') return init;
    const body = JSON.parse(init.body);
    if (!Array.isArray(body.resume)) return init;
    for (const item of body.resume) {
        const instruction = outcomes[item.interruptId]?.instruction;
        if (instruction) item.payload = { ...item.payload, instruction };
    }
    return { ...init, body: JSON.stringify(body) };
}

/** A welcome shows only while nothing has been said. */
function watchEmptyState(chat, viewport) {
    const welcome = chat.querySelector('[data-aparte-empty-state]');
    if (!welcome) return;
    const observer = new MutationObserver(() => hideIfSpoken());
    function hideIfSpoken() {
        if (viewport.getMessages().length === 0) return;
        welcome.hidden = true;
        observer.disconnect();
    }
    observer.observe(viewport, { childList: true, subtree: true });
    hideIfSpoken();
}

let followingDark = false;

/** Tailwind's `dark` class, the switch Filament and most Laravel apps use, drives the chat's theme. */
function followDarkClass() {
    // Once per page load: every wire:navigate asks again, and each answer would add an observer.
    if (followingDark) return;
    followingDark = true;
    const root = document.documentElement;
    const apply = () => {
        root.dataset.aparteTheme = root.classList.contains('dark') ? 'dark' : 'light';
    };
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class'] });
    apply();
}

const running = [];
const setups = [];

/**
 * Adds to every chat on the page, and chooses what it runs on. Called with each chat's config,
 * its element and its options before it starts, and with the chats already running:
 * - plugins, and cards of your own: `onAparteSetup((config) => setupKatex({}, config))`;
 * - `options.storage`: where the conversations are kept, an aparté storage adapter. The one
 *   it holds when you are called is the package's: the tab's, or the server's when the view
 *   names the routes that keep them (`conversations="…"`, for someone signed in);
 * - `options.client`: what the chat's `AparteClient` is built with. Its `streamRunner` is the
 *   package's, an AG-UI runner to the chat's endpoint, when the chat has one: replace it with
 *   a runner of yours, or delete it and aparté's own loop calls the provider you registered
 *   on the config.
 * - `options.people.subscribe(conversationId, onChange, channel)`: for a chat someone of your
 *   team can take over (`people="…"`), how what they do reaches this page when it is not Laravel
 *   Echo (`window.Echo`, used by default): listen on `channel` (`{ name, private }`, as the server
 *   named it), call `onChange` with each change it broadcasts (`ConversationChanged`), and
 *   return the function that stops listening.
 * The storage and the client are read once, when the chat starts: for a chat already running,
 * a change to them does nothing. What the function returns, if a function, runs when the chat
 * stops. Works when your app builds this file with its own Vite (`APARTE_ASSETS=vite`), so that
 * what you add and the chat share one copy of aparté. Call it at the top level of the entry
 * that imports this file, and keep it synchronous: a chat starts once that entry has run.
 * To change the config only (the error card, a sentence, a tool's label), no build is needed:
 * each chat also sends `aparte:setup` before it starts, with `{ config, chat, options }` as its
 * `detail`, which a script of the page can listen for on `document`.
 */
export function onAparteSetup(setup) {
    setups.push(setup);
    for (const entry of running) entry.stops.push(runSetup(setup, entry.config, entry.chat, entry.options));
}

/** A plugin that fails is reported, and the chat goes on without it. */
function runSetup(setup, config, chat, options) {
    try {
        return setup(config, chat, options);
    } catch (error) {
        console.error('aparté: a function given to onAparteSetup failed.', error);
        return undefined;
    }
}

const unknownChats = new Set();

/**
 * The chat an element of the view belongs to: the one it names (`for`, or a list's own
 * `target`), else the chat of the nearest block that holds one. A page with one chat is that
 * block.
 */
function chatOf(element) {
    const named = element.getAttribute('for') || (element.localName === 'aparte-conversation-list' ? element.getAttribute('target') : null);
    if (named) {
        const chat = document.getElementById(named);
        if (chat?.localName === 'aparte-chat') return chat;
        if (!unknownChats.has(named)) {
            unknownChats.add(named);
            console.warn(`aparté: an element names the chat "${named}", and no <aparte-chat> of the page has that id.`);
        }
        return null;
    }
    for (let block = element.parentElement; block; block = block.parentElement) {
        const chat = block.querySelector('aparte-chat[data-aparte-endpoint]');
        if (chat) return chat;
    }
    return null;
}

/** What a view wrote around a chat: its lists, the elements that name its conversation, its new-chat controls. */
function uiOf(chat) {
    const mine = (selector) => [...document.querySelectorAll(selector)].filter((element) => chatOf(element) === chat);
    return {
        lists: () => mine('aparte-conversation-list'),
        titles: () => mine('[data-aparte-title]'),
        any: () => mine('aparte-conversation-list, [data-aparte-new-chat]').length > 0,
    };
}

/**
 * What a view writes around a chat follows that chat, with no script in the app:
 * `<aparte-conversation-list>` shows its conversations, `[data-aparte-new-chat]` opens an
 * empty one, and `[data-aparte-title]` names the one that is open (the attribute's value, or
 * the element's own words, stand for a conversation with no name yet). Returns the function
 * that lets go of them.
 */
function bindConversationUi(chat, config, manager, controller, ui) {
    const attached = new WeakSet();
    const ownWords = new WeakMap();

    const render = () => {
        const active = manager.active;
        const rows = manager.activeConversations.map(({ id, title, updatedAt, pinnedAt }) => ({ id, title, updatedAt, pinnedAt }));
        for (const list of ui.lists()) {
            if (!attached.has(list)) {
                // The list is this chat's: its words and its icons are the chat's config's, and
                // `target` tells aparté which chat a click opens the conversation in, and whose
                // conversations its menu renames and deletes.
                attachConfig(list, config);
                if (!list.hasAttribute('target')) list.setAttribute('target', chat.id);
                attached.add(list);
            }
            list.conversations = rows;
            if (active) list.setAttribute('active-id', active.id);
            else list.removeAttribute('active-id');
        }
        for (const title of ui.titles()) {
            // The attribute first: a page Livewire brings back holds the last conversation's
            // name where the element's own words were.
            if (!ownWords.has(title)) ownWords.set(title, title.getAttribute('data-aparte-title') || title.textContent);
            title.textContent = active?.title || ownWords.get(title);
        }
    };

    /** Where the sidebar is a drawer over the chat, choosing in it is done with it. */
    const closeDrawer = (element) => {
        const sidebar = element.closest('aparte-sidebar');
        if (sidebar?.drawer) sidebar.close();
    };

    const onSelect = (event) => {
        if (event.detail?.targetId !== chat.id) return;
        const list = event.target?.closest?.('aparte-conversation-list');
        if (list) closeDrawer(list);
    };

    const onClick = (event) => {
        const control = event.target?.closest?.('[data-aparte-new-chat]');
        if (!control || chatOf(control) !== chat) return;
        closeDrawer(control);
        void controller.setConversationId(null);
        chat.querySelector('aparte-composer-input')?.focus();
    };

    document.addEventListener('aparte-conversation-select', onSelect);
    document.addEventListener('click', onClick);
    const unsubscribe = manager.subscribe(render);
    render();
    return () => {
        document.removeEventListener('aparte-conversation-select', onSelect);
        document.removeEventListener('click', onClick);
        unsubscribe();
    };
}

/**
 * How a change of the conversation reaches the page: the app's own `subscribe`, else Laravel
 * Echo, on the channel the server named (private for a signed-in person, public under a secret
 * name for a guest). Read when a conversation opens, not when the chat starts: an app's bootstrap
 * may set up Echo after this file has run.
 */
function peopleChannel(options) {
    if (typeof options.people?.subscribe === 'function') return options.people.subscribe;
    const echo = globalThis.Echo;
    if (!echo || typeof echo.private !== 'function') return null;
    return (conversationId, onChange, channel) => {
        (channel.private ? echo.private(channel.name) : echo.channel(channel.name)).listen('.aparte.changed', onChange);
        return () => echo.leave(channel.name);
    };
}

/**
 * A chat someone of your team can take over (`people="…"`, `People` on the server). When a
 * conversation opens, the assistant stays quiet until the server says who holds it; what the
 * team does arrives on the conversation's channel (a message, a note, the assistant turned off
 * or on); and what the person writes while someone holds it goes to the people route, since no
 * request to the assistant carries it. Returns the function that lets go.
 */
const PERSON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>';

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function bindPeople(chat, config, manager, client, options, { url, csrf, assistant, thread = null }) {
    let open = null;
    // A chat with one named conversation (`thread="…"`) answers in it: the people routes and the
    // channel follow that one, not the id the manager minted for the tab.
    const idOf = (id) => thread ?? id;
    let heard = null;
    let stopListening = null;
    let warned = false;
    const route = (id) => `${url.replace(/\/+$/, '')}/${encodeURIComponent(id)}`;
    // A chat without an assistant (no `endpoint`): every message goes to the team, the first one
    // putting the conversation in their queue. Nothing turns the assistant on.
    const answers = (on) => assistant && on;
    if (!assistant) config.setAutoReply(false);

    // The visitor's own way to ask for someone of the team: a button beside send, while the
    // assistant answers an open conversation. It hands the conversation over without the model.
    const label = assistant ? chat.dataset.apartePeopleButton ?? '' : '';
    let button = null;
    const row = label ? chat.querySelector('aparte-composer .aparte-composer-row') : null;
    if (row) {
        button = document.createElement('aparte-composer-action');
        button.className = 'aparte-laravel-people';
        button.setAttribute('action-id', 'aparte-people-want');
        button.setAttribute('label', label);
        button.setAttribute('icon', `${PERSON_ICON}<span>${escapeHtml(label)}</span>`);
        button.style.display = 'none';
        row.insertBefore(button, row.querySelector('aparte-composer-send'));
    }
    // A field to get the team's answer by e-mail too, while the conversation waits for the team
    // (`:people-email`, for a guest): sent once, then a notice says where the answer goes.
    const emailWords = chat.dataset.apartePeopleEmail ?? '';
    const emailLeft = new Set();
    let emailBox = null;
    if (emailWords) {
        emailBox = document.createElement('form');
        emailBox.className = 'aparte-laravel-email';
        emailBox.hidden = true;
        const label = document.createElement('label');
        label.className = 'aparte-laravel-email__label';
        label.textContent = emailWords;
        const input = document.createElement('input');
        input.type = 'email';
        input.required = true;
        input.autocomplete = 'email';
        input.maxLength = 254;
        input.id = `${chat.id}-people-email`;
        input.className = 'aparte-field aparte-field--sm';
        input.placeholder = chat.dataset.apartePeopleEmailPlaceholder ?? '';
        label.htmlFor = input.id;
        const send = document.createElement('button');
        send.type = 'submit';
        send.className = 'aparte-btn aparte-btn--sm aparte-btn--surface';
        send.textContent = chat.dataset.apartePeopleEmailSend || 'Send';
        const row = document.createElement('span');
        row.className = 'aparte-laravel-email__row';
        row.append(input, send);
        emailBox.append(label, row);
        emailBox.addEventListener('submit', (event) => {
            event.preventDefault();
            const id = open;
            if (!id || !input.value) return;
            send.disabled = true;
            fetch(`${route(id)}/email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                credentials: 'same-origin',
                body: JSON.stringify({ email: input.value }),
            })
                .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
                .then(({ notice = null } = {}) => {
                    emailLeft.add(id);
                    input.value = '';
                    if (notice) apply(id, { type: 'message', message: notice });
                    showButton();
                })
                .catch((error) => console.warn('aparté: the e-mail for the answer was not kept.', error))
                .finally(() => { send.disabled = false; });
        });
    }

    // How the conversation went, when your team closed it and asks (`:people-rating`): two buttons,
    // answered once, then a thank-you in the conversation.
    const ratingWords = chat.dataset.apartePeopleRating ?? '';
    const ratingAsked = new Set();
    // The conversations where the person waits for the team's first word: handed over (the button,
    // the assistant, the server's state), until someone of the team writes or the assistant is back.
    const owed = new Set();
    let ratingBox = null;
    const rate = (value) => {
        const id = open;
        if (!id) return;
        fetch(`${route(id)}/rating`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
            credentials: 'same-origin',
            body: JSON.stringify({ value }),
        })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
            .then(({ notice = null } = {}) => {
                ratingAsked.delete(id);
                showButton();
                if (notice) apply(id, { type: 'message', message: notice });
            })
            .catch((error) => console.warn('aparté: the rating was not kept.', error));
    };
    if (ratingWords) {
        ratingBox = document.createElement('div');
        ratingBox.className = 'aparte-laravel-rating';
        ratingBox.setAttribute('role', 'group');
        ratingBox.setAttribute('aria-label', ratingWords);
        ratingBox.hidden = true;
        const question = document.createElement('span');
        question.textContent = ratingWords;
        const answer = (value, label, glyph) => {
            const choice = document.createElement('button');
            choice.type = 'button';
            choice.className = 'aparte-btn aparte-btn--sm aparte-btn--surface';
            choice.dataset.rating = value;
            choice.setAttribute('aria-label', label);
            choice.title = label;
            choice.textContent = glyph;
            choice.addEventListener('click', () => rate(value));
            return choice;
        };
        ratingBox.append(question, answer('up', chat.dataset.apartePeopleRatingUp || 'Good', '👍'), answer('down', chat.dataset.apartePeopleRatingDown || 'Not good', '👎'));
    }

    // Two kinds of files: the team's, kept on your disk (`:people-files`), and the chat's own, which go to the
    // model with the message (`files`). Who answers says which the paperclip offers; with neither, there is none.
    const fileTypes = chat.dataset.apartePeopleFiles;
    const modelTypes = chat.dataset.aparteFiles;
    // A page that set `attachments` itself (not through `files`) keeps its paperclip as it set it.
    const ownPaperclip = chat.hasAttribute('attachments') && modelTypes === undefined;

    // An answer is owed: the last message, notices aside, is the person's.
    const awaiting = () => chat.viewport?.getMessages().filter((message) => message.kind !== 'notice').at(-1)?.role === 'user';

    const showButton = () => {
        if (button) button.style.display = open && config.getAutoReply(open) ? '' : 'none';
        // "Get the answer by e-mail" while an answer from the team is owed, and never beside the
        // rating question: once the team has answered, or closed it, there is nothing to wait for.
        if (emailBox) emailBox.hidden = !(open && !config.getAutoReply(open) && !emailLeft.has(open) && !ratingAsked.has(open) && (owed.has(open) || awaiting()));
        if (ratingBox) ratingBox.hidden = !(open && ratingAsked.has(open));
        // The paperclip offers the team's files while someone of the team is in the conversation (and from the
        // start in a chat with the team only), the chat's own while the assistant answers.
        if ((fileTypes !== undefined || modelTypes !== undefined) && !ownPaperclip) {
            const team = !assistant || Boolean(open && !config.getAutoReply(open));
            offerFiles(chat, (team ? fileTypes : modelTypes) ?? null);
        }
    };

    // Someone of the team is writing: a line above the composer, gone after a few seconds or when
    // their message arrives.
    const typingWords = chat.dataset.apartePeopleTyping || ':name is typing…';
    const typingLine = document.createElement('div');
    typingLine.className = 'aparte-laravel-typing';
    typingLine.setAttribute('aria-live', 'polite');
    typingLine.hidden = true;
    chat.querySelector('aparte-composer')?.before(typingLine);
    if (emailBox) typingLine.before(emailBox);
    if (ratingBox) typingLine.before(ratingBox);
    let typingTimer = null;
    const showTyping = (name) => {
        typingLine.textContent = typingWords.replace(':name', name);
        typingLine.hidden = false;
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => (typingLine.hidden = true), 6000);
    };
    const hideTyping = () => {
        clearTimeout(typingTimer);
        typingLine.hidden = true;
    };

    // What the person does while someone of the team is in the conversation: that they are writing
    // (at most every few seconds), and that they have seen the team's messages (when the tab is in front).
    const tell = (id, what) => fetch(`${route(id)}/${what}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
        credentials: 'same-origin',
    }).catch(() => {});
    let lastTyping = 0;
    const onInput = () => {
        const id = open;
        if (!id || config.getAutoReply(id) || Date.now() - lastTyping < 3000) return;
        lastTyping = Date.now();
        void tell(id, 'typing');
    };
    let unseen = false;
    const markSeen = () => {
        if (!unseen || !open || document.visibilityState !== 'visible') return;
        unseen = false;
        void tell(open, 'seen');
    };

    const apply = (id, change) => {
        if (id !== open || !change || typeof change !== 'object') return;
        const viewport = chat.viewport;
        if (change.type === 'message' && typeof change.message?.id === 'string') {
            if (!viewport.getMessages().some((message) => message.id === change.message.id)) viewport.appendMessage(change.message);
            if (change.message.author?.type === 'human') owed.delete(id);
            showButton();
            if (change.message.author?.type === 'human') {
                hideTyping();
                unseen = true;
                markSeen();
            }
        } else if (change.type === 'typing' && typeof change.author?.name === 'string') {
            showTyping(change.author.name);
        } else if (change.type === 'note' && typeof change.messageId === 'string') {
            viewport.updateMessage(change.messageId, { note: typeof change.note === 'string' ? change.note : undefined });
        } else if (change.type === 'rating') {
            ratingAsked.add(id);
            showButton();
        } else if (change.type === 'auto-reply') {
            const on = answers(change.on !== false);
            config.setAutoReply(on, id);
            // Off: the conversation went to the team, which owes the person an answer. On: the assistant is back.
            if (on) owed.delete(id);
            else owed.add(id);
            showButton();
            // Back to the assistant: a reply that paused on a question goes on.
            if (on) void client.resumeDeferred(chat);
        }
    };

    const subscribe = (id, channel) => {
        if (heard === id || !channel?.name) return;
        const listen = peopleChannel(options);
        if (!listen) {
            if (!warned) {
                warned = true;
                console.warn('aparté: this chat names the people routes (people="…"), and nothing brings what your team does to the page: set up Laravel Echo (window.Echo), or give options.people.subscribe in onAparteSetup.');
            }
            return;
        }
        heard = id;
        const stop = listen(id, (change) => apply(id, change), channel);
        stopListening = typeof stop === 'function' ? stop : null;
    };

    // Who holds the conversation, and the channel to hear the team on. Unreachable, it is the
    // assistant's, and nothing is heard.
    const ask = (id, resume, answered = () => {}) => {
        fetch(route(id), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then((response) => (response.ok ? response.json() : {}))
            .catch(() => ({}))
            .then(({ heldBy = null, wanted = false, emailLeft: left = false, rating = null, channel = null } = {}) => {
                answered();
                if (left) emailLeft.add(id);
                if (rating === 'asked') ratingAsked.add(id);
                if (wanted && !heldBy) owed.add(id);
                config.setAutoReply(answers(!heldBy && !wanted), id);
                if (open !== id) return;
                showButton();
                subscribe(id, channel);
                if (resume && assistant && !heldBy) void client.resumeDeferred(chat);
            });
    };

    const follow = (id) => {
        if (id === open) return;
        stopListening?.();
        stopListening = null;
        heard = null;
        open = id;
        showButton();
        if (id) ask(id, false);
    };

    // A conversation opens: quiet, before the client's own listener can resume a paused reply,
    // until the server says whether someone holds it.
    const onLoaded = (event) => {
        const loaded = event.detail?.conversationId;
        if (event.detail?.targetId !== chat.id || typeof loaded !== 'string') return;
        const id = idOf(loaded);
        config.setAutoReply(false, id);
        if (id !== open) {
            stopListening?.();
            stopListening = null;
            heard = null;
            open = id;
        }
        // Until the server says who answers it, the composer waits: a message typed in that moment
        // would go to neither the assistant nor the team. Only what this adds is taken back.
        const composer = assistant ? chat.querySelector('aparte-composer') : null;
        const locked = Boolean(composer) && !composer.hasAttribute('disabled');
        if (locked) composer.setAttribute('disabled', '');
        ask(id, true, () => {
            if (locked) composer.removeAttribute('disabled');
        });
    };

    // What the person writes while someone holds the conversation, or in a chat without an
    // assistant. Read once the send has been handled: the message is shown, and its id written,
    // by a listener that may run after this one; a first message also opens the conversation.
    const onSend = (event) => {
        const sentIn = open ?? idOf(manager.activeId);
        if (sentIn && config.getAutoReply(sentIn)) return;
        const detail = event.detail ?? {};
        queueMicrotask(() => {
            const id = sentIn ?? open ?? idOf(manager.activeId);
            if (!id || config.getAutoReply(id)) return;
            showButton();
            // With files, a form: they are kept on the server, which says where to open them.
            const files = Array.isArray(detail.files) ? detail.files : [];
            const headers = { Accept: 'application/json', 'X-CSRF-TOKEN': csrf };
            let body;
            if (files.length > 0) {
                body = new FormData();
                body.append('id', detail.messageId ?? '');
                // A chat with the team only: the server hands a new conversation over on its first message.
                body.append('team', assistant ? '0' : '1');
                if (detail.content) body.append('content', detail.content);
                for (const file of files) body.append('files[]', file);
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify({ id: detail.messageId, content: detail.content, team: !assistant });
            }
            fetch(`${route(id)}/messages`, {
                method: 'POST',
                headers,
                credentials: 'same-origin',
                body,
            }).then((response) => {
                if (!response.ok) {
                    console.warn(`aparté: a message for your team was refused (${response.status}).`);
                    return null;
                }
                return response.status === 204 ? null : response.json().catch(() => null);
            }, (error) => {
                console.warn('aparté: a message for your team was not sent.', error);
                return null;
            }).then((answer) => {
                // The files now open from the server, not from this tab's memory, which a reload empties.
                if (Array.isArray(answer?.attachments) && answer.attachments.length > 0 && detail.messageId) {
                    chat.viewport.updateMessage(detail.messageId, { attachments: answer.attachments });
                }
                // The conversation went to the team with this message: what the visitor reads.
                if (answer?.notice) apply(id, { type: 'message', message: answer.notice });
            });
        });
    };

    const onAction = (event) => {
        const id = open;
        if (event.detail?.actionId !== 'aparte-people-want' || !id) return;
        fetch(`${route(id)}/want`, {
            method: 'POST',
            headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
            credentials: 'same-origin',
        })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`status ${response.status}`))))
            .then(({ notice = null } = {}) => {
                config.setAutoReply(false, id);
                owed.add(id);
                if (notice) apply(id, { type: 'message', message: notice });
                showButton();
            })
            .catch((error) => console.warn('aparté: asking for someone of the team failed.', error));
    };

    chat.addEventListener('aparte-conversation-loaded', onLoaded);
    chat.addEventListener('aparte-send', onSend);
    chat.addEventListener('aparte-action-click', onAction);
    chat.addEventListener('input', onInput);
    document.addEventListener('visibilitychange', markSeen);
    // A conversation the chat starts: nobody holds it yet; its channel is asked for and heard.
    const unsubscribe = manager.subscribe(() => follow(idOf(manager.activeId ?? null)));
    // A chat with the team only shows its paperclip before its first message.
    showButton();

    return () => {
        chat.removeEventListener('aparte-conversation-loaded', onLoaded);
        chat.removeEventListener('aparte-send', onSend);
        chat.removeEventListener('aparte-action-click', onAction);
        chat.removeEventListener('input', onInput);
        document.removeEventListener('visibilitychange', markSeen);
        clearTimeout(typingTimer);
        typingLine.remove();
        emailBox?.remove();
        ratingBox?.remove();
        // Back to what the chat offers without the team: its own files, or none.
        if ((fileTypes !== undefined || modelTypes !== undefined) && !ownPaperclip) offerFiles(chat, modelTypes ?? null);
        button?.remove();
        unsubscribe();
        follow(null);
    };
}

// The chat's own words (the composer, its buttons) in the page's language: Laravel's locale, which
// the Blade component gives. "fr", "fr_CA" and "fr-CA" are French; a language without words here
// stays in English, core's own.
let LOCALES = {};
const localeOf = (tag) => {
    const key = String(tag ?? '').toLowerCase().replace(/_/g, '-');
    // Traditional Chinese (zh-TW, zh-HK, zh-Hant) is not Simplified: it stays English.
    if (key.startsWith('zh-') && !['zh-cn', 'zh-hans', 'zh-sg'].some((simplified) => key.startsWith(simplified))) return null;
    return LOCALES[key] ?? LOCALES[key.split('-')[0]] ?? null;
};

/**
 * The chat's own words in the page's language, from `@aparte/locales`: the built chat this package
 * serves has them already. With your app's Vite (`APARTE_ASSETS=vite`), install `@aparte/locales`
 * and pass it here, at the top level of the entry that imports this file:
 * `import * as locales from '@aparte/locales'; useLocales(locales);`. Without it, the chat speaks
 * English, as before.
 */
export function useLocales({ de, es, fr, it, ja, ko, ptBR, ru, zhCN } = {}) {
    LOCALES = Object.fromEntries(Object.entries({ de, es, fr, it, ja, ko, 'pt-br': ptBR, pt: ptBR, ru, 'zh-cn': zhCN, zh: zhCN }).filter(([, words]) => words));
}

/**
 * Offer files on a chat, of these types, or none (`null`). aparté draws the paperclip from the `attachments`
 * attribute; the types go on the picker once it is drawn.
 */
function offerFiles(chat, types) {
    chat.toggleAttribute('attachments', types !== null);
    if (types !== null) queueMicrotask(() => chat.querySelector('aparte-composer-add-attachment')?.setAttribute('accept', types));
}

/**
 * The paperclip of a composer this package wrote (a view with slots, `data-aparte-laravel-shell`). aparté adds
 * and removes it with `attachments` only in a composer it wrote itself; this does the same, the same way, here.
 */
function followPaperclip(chat) {
    const shell = chat.querySelector('[data-aparte-laravel-shell]');
    if (!shell) return null;
    const sync = () => {
        const row = shell.querySelector('.aparte-composer-row');
        if (!row) return;
        const strip = shell.querySelector('aparte-composer-attachments');
        const picker = row.querySelector('aparte-composer-add-attachment');
        if (chat.hasAttribute('attachments')) {
            if (!strip) shell.insertBefore(document.createElement('aparte-composer-attachments'), row);
            if (!picker) row.insertBefore(document.createElement('aparte-composer-add-attachment'), row.firstChild);
            return;
        }
        strip?.remove();
        picker?.remove();
        // Files picked before the paperclip went would otherwise ride on the next send, with nothing showing them.
        chat.composer?.clearAttachments?.();
    };
    const watcher = new MutationObserver(sync);
    watcher.observe(chat, { attributes: true, attributeFilter: ['attachments'] });
    return () => watcher.disconnect();
}

async function mount(chat) {
    chat.dataset.aparteMounted = '';

    const {
        aparteEndpoint: endpoint,
        aparteCsrf: csrf,
        aparteThread: givenThread,
        aparteScope: scope,
        aparteConversations: conversations,
        apartePeople: people,
    } = chat.dataset;

    const config = new AparteConfig();
    attachConfig(chat, config);
    const locale = localeOf(chat.dataset.aparteLocale);
    if (locale) config.setLocale(locale);
    // A link to this site follows in the page, like the rest of the Laravel app; a link to another
    // site opens in a new tab. aparté's own default opens every link in a new tab.
    config.setLinkTarget('external-only');
    setupMarkedStreamingProvider(undefined, config);
    // Handing the conversation to the team (AskForSomeone) is the package's own tool: the visitor
    // reads what the assistant and the team say, never the call itself. An app's setup can show it.
    config.registerToolDisplay('AskForSomeone', { hidden: true });

    // What the chat runs on: the package's own first, for the app's setup to keep or replace.
    // Its conversations go to the server when the view names the routes that keep them
    // (`conversations="…"`, for someone signed in), else they stay in the tab.
    let manager;
    const fallbackThread = uuid();
    let outcomes = {};
    const ui = uiOf(chat);
    const kept = conversations
        ? new ServerStorage(conversations, {
            csrf: csrf ?? '',
            onProblem: (problem) => {
                // Deleted somewhere else: the list is read again, and its row goes.
                if (problem.reason === 'gone') void manager?.init().catch(() => {});
                chat.dispatchEvent(new CustomEvent('aparte-conversations-problem', { detail: problem, bubbles: true, composed: true }));
            },
        })
        : null;
    const options = { storage: kept ?? new TabStorage(`aparte-laravel:${endpoint}:${scope ?? ''}:${chat.id}`), client: {}, people: {} };

    // `thread` names the one conversation of a chat that has one. A chat with a list, or a way
    // to start another, has many: each is its own thread, or the model would remember them all
    // as one and a deleted one would not be forgotten.
    const single = Boolean(givenThread) && !conversations && !ui.any();
    if (givenThread && !single) {
        console.warn(`aparté: this chat has a list of conversations, so each is its own thread and thread="${givenThread}" is not used.`);
    }
    if (endpoint) {
        const runner = createAgUiRunner({
            endpoint,
            threadId: () => (single && givenThread) || manager?.activeId || fallbackThread,
            headers: { 'X-CSRF-TOKEN': csrf ?? '' },
            fetch: (url, init) => fetch(url, withInstructions(init, outcomes)),
        });
        options.client.streamRunner = (run) => {
            outcomes = run.deferral?.outcomes ?? {};
            return runner(run);
        };
    }

    // Known before the first wait: a setup registered while the conversations load reaches this
    // chat, and a page left meanwhile stops it.
    const entry = { chat, config, options, stops: [], stopped: false, storage: null };
    // The app's own, last: aparté's plugins and its own cards, before anything is drawn.
    entry.stops = setups.map((setup) => runSetup(setup, config, chat, options));
    // The same door for a page that builds nothing, the package's own file included: any script
    // of the page listens for it, as for Livewire's `livewire:init`. A listener that throws is
    // reported by the browser, and the chat goes on.
    chat.dispatchEvent(new CustomEvent('aparte:setup', { bubbles: true, detail: { config, chat, options } }));
    // Nothing answers: no assistant (endpoint), no team (people), and no runner of the app's.
    if (!options.client.streamRunner && !people) {
        console.warn('aparté: this chat has no endpoint, no people routes and no runner: nothing answers what is written in it.');
    }
    entry.storage = options.storage;
    running.push(entry);

    // The chat answers from here on, before its conversations have arrived: with a server
    // behind them that is a round trip, and a message sent during it went nowhere.
    manager = new AparteConversationManager(options.storage);
    config.setConversationManager(manager);

    const viewport = chat.viewport;
    const controller = new AparteConversationController({
        hostId: chat.id,
        host: chat,
        getMessages: () => viewport.getMessages(),
        setMessages: (messages) => viewport.setMessages(messages),
        appendMessage: (message) => viewport.appendMessage(message),
        clearMessages: (options) => viewport.clearAll(options),
        setLoading: (loading) => viewport.setLoading(loading),
        exportTree: () => viewport.exportTree(),
        importTree: (tree) => viewport.importTree(tree),
    });
    controller.bind();

    // The chat's own config and its own id, whatever the app wrote: a client that answered
    // another chat's sends, or read another config, would be the app's bug to find here.
    const client = new AparteClient({ ...options.client, config, scopeToTargetId: chat.id });
    client.start();
    // Before the team's code turns the paperclip on or off, so a composer the view wrote follows it too.
    const unfollowPaperclip = followPaperclip(chat);
    // The chat's own files (`files`), with no team to hand the paperclip to: offered from the start.
    if (chat.dataset.aparteFiles !== undefined && !people) offerFiles(chat, chat.dataset.aparteFiles);
    Object.assign(entry, {
        client,
        controller,
        unfollowPaperclip,
        unbindUi: bindConversationUi(chat, config, manager, controller, ui),
        unbindPeople: people ? bindPeople(chat, config, manager, client, options, { url: people, csrf: csrf ?? '', assistant: Boolean(endpoint), thread: single ? givenThread : null }) : null,
    });
    watchEmptyState(chat, viewport);

    const lists = ui.lists();
    for (const list of lists) list.setAttribute('loading', '');
    try {
        await manager.init();
    } catch (error) {
        if (options.storage === kept) {
            // The server will answer again. What is said meanwhile is sent when it does, and the
            // list is read then: left in the tab, it would be where the server never looks.
            console.warn('aparté: the conversations could not be loaded; they will be when the server answers.', error);
            kept.whenBack(() => manager.init());
        } else {
            console.warn('aparté: the conversations could not be loaded; this chat goes on without them.', error);
        }
    } finally {
        for (const list of lists) list.removeAttribute('loading');
    }
    // The page was left while the conversations loaded, or something was said: either way the
    // chat is no longer waiting to be shown its last conversation.
    if (entry.stopped || manager.activeId) return;
    // After the client: a saved conversation may hold a question it has to ask again.
    await controller.setConversationId(manager.activeConversations[0]?.id ?? null);
}

function mountAll() {
    const chats = document.querySelectorAll('aparte-chat[data-aparte-endpoint]:not([data-aparte-mounted])');
    if (chats.length === 0) return;
    if ([...chats].some((chat) => 'aparteFollowDark' in chat.dataset)) followDarkClass();
    customElements.whenDefined('aparte-chat').then(() => chats.forEach((chat) => {
        mount(chat).catch((error) => console.error('aparté: a chat did not start.', error));
    }));
}

/**
 * The chats on the page being left: their clients would answer the next page's chats too.
 * Their mark goes too: Livewire keeps the page's HTML for the Back button, and a chat brought
 * back with it must start again. A chat still loading its conversations is stopped as well:
 * it finds out when they arrive.
 */
function stopAll() {
    for (const entry of running.splice(0)) {
        entry.stopped = true;
        delete entry.chat.dataset.aparteMounted;
        try {
            for (const stop of entry.stops) if (typeof stop === 'function') stop();
            entry.storage?.stop?.();
            entry.unbindUi?.();
            entry.unbindPeople?.();
            entry.unfollowPaperclip?.();
            entry.controller?.unbind();
            entry.client?.stop();
        } catch (error) {
            console.error('aparté: a chat did not stop cleanly.', error);
        }
    }
}

// One copy per page. The package's own file and an app's build both on a page would mount each
// chat twice, and only one of them would have the app's plugins.
if (globalThis.__aparteLaravel) {
    console.warn('aparté for Laravel is loaded twice on this page; the second copy does nothing. If your app imports it, set APARTE_ASSETS=vite so that the package stops serving its own.');
} else {
    globalThis.__aparteLaravel = true;
    // After the page's own scripts, so that an app's `onAparteSetup` comes before the first chat.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll, { once: true });
    else setTimeout(mountAll);
    // Livewire's `wire:navigate`, which Filament's SPA mode uses, swaps the page without reloading this file.
    document.addEventListener('livewire:navigating', stopAll);
    document.addEventListener('livewire:navigated', mountAll);
}
