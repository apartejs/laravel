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

/** Tailwind's `dark` class, the switch Filament and most Laravel apps use, drives the chat's theme. */
function followDarkClass() {
    const root = document.documentElement;
    const apply = () => {
        root.dataset.aparteTheme = root.classList.contains('dark') ? 'dark' : 'light';
    };
    new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class'] });
    apply();
}

let mounted = 0;

async function mount(chat) {
    chat.dataset.aparteMounted = '';
    mounted += 1;
    chat.id ||= `aparte-laravel-chat-${mounted}`;

    const { aparteEndpoint: endpoint, aparteCsrf: csrf, aparteThread: givenThread, aparteScope: scope } = chat.dataset;

    const config = new AparteConfig();
    attachConfig(chat, config);
    setupMarkedStreamingProvider(undefined, config);

    const manager = new AparteConversationManager(new TabStorage(`aparte-laravel:${endpoint}:${scope ?? ''}:${chat.id}`));
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

    const fallbackThread = uuid();
    let outcomes = {};
    const runner = createAgUiRunner({
        endpoint,
        threadId: () => givenThread || manager.activeId || fallbackThread,
        headers: { 'X-CSRF-TOKEN': csrf ?? '' },
        fetch: (url, init) => fetch(url, withInstructions(init, outcomes)),
    });

    new AparteClient({
        config,
        scopeToTargetId: chat.id,
        streamRunner: (options) => {
            outcomes = options.deferral?.outcomes ?? {};
            return runner(options);
        },
    }).start();

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

mountAll();
// Livewire's `wire:navigate`, which Filament's SPA mode uses, swaps the page without reloading this file.
document.addEventListener('livewire:navigated', mountAll);
