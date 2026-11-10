import type { AparteConfig } from '@aparte/core';

/**
 * Adds aparté's plugins, or cards of your own, to every chat on the page. Called with each
 * chat's config and its element before it starts, and with the chats already running. What it
 * returns, if a function, runs when the chat stops. Call it at the top level of the entry that
 * imports this file, and keep it synchronous.
 */
export function onAparteSetup(setup: (config: AparteConfig, chat: HTMLElement) => void | (() => void)): void;
