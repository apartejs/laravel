import type { AparteClientOptions, AparteConfig, AparteStorageAdapter } from '@aparte/core';

/** What a chat runs on. Change it in `onAparteSetup`: it is read once, when the chat starts. */
export interface AparteChatOptions {
    /** Where the conversations are kept. The package's own keeps them for the tab. */
    storage: AparteStorageAdapter;
    /**
     * What the chat's `AparteClient` is built with; its `config` and `scopeToTargetId` stay the
     * chat's own. `streamRunner` is the package's AG-UI runner when the chat has an endpoint:
     * replace it with a runner of yours, or delete it and aparté's own loop calls the provider
     * you registered on the config.
     */
    client: Omit<AparteClientOptions, 'config' | 'scopeToTargetId'>;
}

/**
 * Adds aparté's plugins, or cards of your own, to every chat on the page, and chooses what it
 * runs on. Called with each chat's config, its element and its options before it starts, and
 * with the chats already running. What it returns, if a function, runs when the chat stops.
 * Call it at the top level of the entry that imports this file, and keep it synchronous.
 */
export function onAparteSetup(setup: (config: AparteConfig, chat: HTMLElement, options: AparteChatOptions) => void | (() => void)): void;
