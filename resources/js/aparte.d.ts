import type { AparteClientOptions, AparteConfig, AparteMessage, AparteStorageAdapter } from '@aparte/core';

/** What a chat runs on. Change it in `onAparteSetup`: it is read once, when the chat starts. */
export interface AparteChatOptions {
    /**
     * Where the conversations are kept. The package's own keeps them for the tab, or on the
     * server when the view names the routes that keep them (`conversations="…"`, for someone
     * signed in).
     */
    storage: AparteStorageAdapter;
    /**
     * What the chat's `AparteClient` is built with; its `config` and `scopeToTargetId` stay the
     * chat's own. `streamRunner` is the package's AG-UI runner when the chat has an endpoint:
     * replace it with a runner of yours, or delete it and aparté's own loop calls the provider
     * you registered on the config.
     */
    client: Omit<AparteClientOptions, 'config' | 'scopeToTargetId'>;
    /**
     * For a chat someone of your team can take over (`people="…"`): how what they do reaches the
     * page, when it is not Laravel Echo (`window.Echo`, used by default).
     */
    people: {
        /**
         * Listen on `channel` (as the server named it: private for a signed-in person, public
         * under a secret name for a guest) to the conversation's changes, what
         * `ConversationChanged` broadcasts as `aparte.changed`: call `onChange` with each, and
         * return the function that stops listening.
         */
        subscribe?: (conversationId: string, onChange: (change: ApartePeopleChange) => void, channel: { name: string; private: boolean }) => (() => void) | void;
    };
}

/** What someone of your team did to a conversation, as `ConversationChanged` broadcasts it. */
export type ApartePeopleChange =
    | { type: 'message'; message: AparteMessage }
    | { type: 'note'; messageId: string; note: string | null }
    | { type: 'auto-reply'; on: boolean };

/**
 * Adds aparté's plugins, or cards of your own, to every chat on the page, and chooses what it
 * runs on. Called with each chat's config, its element and its options before it starts, and
 * with the chats already running (for those, a change to the options does nothing). What it
 * returns, if a function, runs when the chat stops. Call it at the top level of the entry that
 * imports this file, and keep it synchronous.
 */
export function onAparteSetup(setup: (config: AparteConfig, chat: HTMLElement, options: AparteChatOptions) => void | (() => void)): void;

/**
 * The chat's own words in the page's language (`app()->getLocale()`), from `@aparte/locales`. The
 * built chat has them; with your app's Vite, install `@aparte/locales` and call
 * `useLocales(locales)` with `import * as locales from '@aparte/locales'`, at the top level of the
 * entry. Without it, the chat speaks English.
 */
export function useLocales(locales: Partial<Record<'de' | 'es' | 'fr' | 'it' | 'ja' | 'ko' | 'ptBR' | 'ru' | 'zhCN', object>>): void;

/**
 * Why conversations kept on the server are not, told once for each thing that goes wrong:
 * - `unreachable`: the server is down or out of reach; what is said is sent when it answers;
 * - `signed-out`: nobody is signed in any more; it is sent once someone is;
 * - `too-large`: the conversation weighs more than the server keeps, and is not kept;
 * - `refused`: the server refused it for another reason, and it is not kept;
 * - `gone`: it was deleted somewhere else, and has left the list.
 */
export interface AparteConversationsProblem {
    reason: 'unreachable' | 'signed-out' | 'too-large' | 'refused' | 'gone';
    /** The server's answer, 0 when it was not reached. */
    status: number;
    /** The conversation it is about, when it is about one. */
    conversationId?: string;
}

/**
 * What `aparte:setup` carries: the same three things `onAparteSetup` is called with. It is dispatched on each
 * chat before the chat starts, and bubbles, so a page that builds nothing (the package's own bundle) reaches the
 * config, the element and the options too: replace the storage or the runner, set an attribute of the chat.
 */
export interface AparteSetupDetail {
    config: AparteConfig;
    chat: HTMLElement;
    options: AparteChatOptions;
}

declare global {
    interface DocumentEventMap {
        /** Dispatched on the chat, and bubbling: see the README, "Conversations in your database". */
        'aparte-conversations-problem': CustomEvent<AparteConversationsProblem>;
        /** Dispatched on each chat before it starts, and bubbling: see the README, "Your own storage, your own runner". */
        'aparte:setup': CustomEvent<AparteSetupDetail>;
    }
}
