<?php

return [

    // Where the chat's JavaScript and CSS come from.
    // 'bundle': the package serves its own built copy; nothing to install or build.
    // 'vite': your app builds it with its own Vite, so it can add aparté's plugins
    // with onAparteSetup (see the README, "Plugins").
    'assets' => env('APARTE_ASSETS', 'bundle'),

    // The conversations a chat keeps in your database, behind the routes of
    // Route::aparteConversations() (see the README, "Conversations in your database").
    'conversations' => [
        'table' => 'aparte_conversations',
        // What one conversation may weigh, in bytes, as the browser sends it.
        'max_bytes' => 2 * 1024 * 1024,
        // How many the list gives, the most recent first.
        'list' => 200,
    ],

];
