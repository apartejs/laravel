import '@aparte/core/styles.css';
import { AparteClient } from '@aparte/core';
import { createAgUiRunner } from '@aparte/runner-ag-ui';
import { setupMarkedStreamingProvider } from '@aparte/plugin-marked/streaming';

setupMarkedStreamingProvider();

const THREADS_KEY = 'aparte-laravel-thread:';

/** The thread a chat runs in: the one the page gave, else one this tab keeps for that endpoint. */
function threadFor(chat, endpoint) {
    if (chat.dataset.aparteThread) return chat.dataset.aparteThread;
    const key = THREADS_KEY + endpoint;
    try {
        const saved = sessionStorage.getItem(key);
        if (saved) return saved;
        const minted = crypto.randomUUID();
        sessionStorage.setItem(key, minted);
        return minted;
    } catch {
        return crypto.randomUUID();
    }
}

const chat = document.querySelector('aparte-chat[data-aparte-endpoint]');

if (chat) {
    const endpoint = chat.dataset.aparteEndpoint;
    const threadId = threadFor(chat, endpoint);
    new AparteClient({
        streamRunner: createAgUiRunner({
            endpoint,
            threadId,
            headers: { 'X-CSRF-TOKEN': chat.dataset.aparteCsrf ?? '' },
        }),
    }).start();
}
