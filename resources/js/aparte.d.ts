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

declare global {
    interface DocumentEventMap {
        /** Dispatched on the chat, and bubbling: see the README, "Conversations in your database". */
        'aparte-conversations-problem': CustomEvent<AparteConversationsProblem>;
    }
}
