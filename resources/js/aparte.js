import '@aparte/core/styles.css';
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
 *   it holds when you are called is the package's, which keeps them for the tab;
 * - `options.client`: what the chat's `AparteClient` is built with. Its `streamRunner` is the
 *   package's, an AG-UI runner to the chat's endpoint, when the chat has one: replace it with
 *   a runner of yours, or delete it and aparté's own loop calls the provider you registered
 *   on the config.
 * The storage and the client are read once, when the chat starts. What the function returns,
 * if a function, runs when the chat stops. Works when your app builds this file with its own
 * Vite (`APARTE_ASSETS=vite`), so that what you add and the chat share one copy of aparté.
 * Call it at the top level of the entry that imports this file, and keep it synchronous: a
 * chat starts once that entry has run.
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

/**
 * The chat an element of the view belongs to: the one its `for` names, else the chat of the
 * nearest block that holds one. A page with one chat is that block.
 */
function chatOf(element) {
    const named = element.getAttribute('for');
    if (named) return document.getElementById(named);
    for (let block = element.parentElement; block; block = block.parentElement) {
        const chat = block.querySelector('aparte-chat[data-aparte-endpoint]');
        if (chat) return chat;
    }
    return null;
}

/**
 * What a view writes around a chat follows that chat, with no script in the app:
 * `<aparte-conversation-list>` shows its conversations, `[data-aparte-new-chat]` opens an
 * empty one, and `[data-aparte-title]` names the one that is open (its own words stand for a
 * conversation with no name yet). Returns the function that lets go of them.
 */
function bindConversationUi(chat, config, manager, controller) {
    const mine = (selector) => [...document.querySelectorAll(selector)].filter((element) => chatOf(element) === chat);
    const attached = new WeakSet();
    const ownWords = new WeakMap();

    const render = () => {
        const active = manager.active;
        const rows = manager.activeConversations.map(({ id, title, updatedAt, pinnedAt }) => ({ id, title, updatedAt, pinnedAt }));
        for (const list of mine('aparte-conversation-list')) {
            // The list resolves this chat's config, so that `manage` acts on this chat's storage.
            if (!attached.has(list)) {
                attachConfig(list, config);
                attached.add(list);
            }
            list.conversations = rows;
            if (active) list.setAttribute('active-id', active.id);
            else list.removeAttribute('active-id');
        }
        for (const title of mine('[data-aparte-title]')) {
            if (!ownWords.has(title)) ownWords.set(title, title.textContent);
            title.textContent = active?.title || ownWords.get(title);
        }
    };

    /** On a phone the sidebar is a drawer over the chat: choosing in it is done with it. */
    const closeDrawer = (element) => {
        const sidebar = element.closest('aparte-sidebar');
        if (sidebar?.drawer) sidebar.close();
    };

    // A list says which conversation, not which chat: on a page with two chats, every chat
    // would open it. The ones that belong to this chat say so, before any chat hears them.
    const onSelect = (event) => {
        const list = event.target?.closest?.('aparte-conversation-list');
        if (!list || chatOf(list) !== chat || !event.detail || event.detail.targetId) return;
        event.detail.targetId = chat.id;
        closeDrawer(list);
    };

    const onClick = (event) => {
        const control = event.target?.closest?.('[data-aparte-new-chat]');
        if (!control || chatOf(control) !== chat) return;
        closeDrawer(control);
        void controller.setConversationId(null);
        chat.querySelector('aparte-composer-input')?.focus();
    };

    document.addEventListener('aparte-conversation-select', onSelect, true);
    document.addEventListener('click', onClick);
    const unsubscribe = manager.subscribe(render);
    render();
    return () => {
        document.removeEventListener('aparte-conversation-select', onSelect, true);
        document.removeEventListener('click', onClick);
        unsubscribe();
    };
}

async function mount(chat) {
    chat.dataset.aparteMounted = '';

    const { aparteEndpoint: endpoint, aparteCsrf: csrf, aparteThread: givenThread, aparteScope: scope } = chat.dataset;

    const config = new AparteConfig();
    attachConfig(chat, config);
    setupMarkedStreamingProvider(undefined, config);

    // What the chat runs on: the package's own first, for the app's setup to keep or replace.
    let manager;
    const fallbackThread = uuid();
    let outcomes = {};
    const options = {
        storage: new TabStorage(`aparte-laravel:${endpoint}:${scope ?? ''}:${chat.id}`),
        client: {},
    };
    if (endpoint) {
        const runner = createAgUiRunner({
            endpoint,
            threadId: () => givenThread || manager?.activeId || fallbackThread,
            headers: { 'X-CSRF-TOKEN': csrf ?? '' },
            fetch: (url, init) => fetch(url, withInstructions(init, outcomes)),
        });
        options.client.streamRunner = (run) => {
            outcomes = run.deferral?.outcomes ?? {};
            return runner(run);
        };
    }
    // The app's own, last: aparté's plugins and its own cards, before anything is drawn.
    const stops = setups.map((setup) => runSetup(setup, config, chat, options));

    manager = new AparteConversationManager(options.storage);
    await manager.init();
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
    const unbindUi = bindConversationUi(chat, config, manager, controller);
    running.push({ client, controller, config, chat, stops, options, unbindUi });

    // After the client: a saved conversation may hold a question it has to ask again.
    await controller.setConversationId(manager.activeConversations[0]?.id ?? null);
    watchEmptyState(chat, viewport);
}

function mountAll() {
    const chats = document.querySelectorAll('aparte-chat[data-aparte-endpoint]:not([data-aparte-mounted])');
    if (chats.length === 0) return;
    if ([...chats].some((chat) => 'aparteFollowDark' in chat.dataset)) followDarkClass();
    customElements.whenDefined('aparte-chat').then(() => chats.forEach(mount));
}

/**
 * The chats on the page being left: their clients would answer the next page's chats too.
 * Their mark goes too: Livewire keeps the page's HTML for the Back button, and a chat brought
 * back with it must start again.
 */
function stopAll() {
    for (const { client, controller, stops, chat, unbindUi } of running.splice(0)) {
        delete chat.dataset.aparteMounted;
        try {
            for (const stop of stops) if (typeof stop === 'function') stop();
            unbindUi();
            controller.unbind();
            client.stop();
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
