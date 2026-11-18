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

    // Files a person sends to your team, and your team to them, while someone of it is in the
    // conversation (`:people-files="true"` on the chat; see the README, "Files").
    'people' => [
        'files' => [
            // Where they are kept: a private disk of your app's.
            'disk' => 'local',
            // What one file may weigh, in kilobytes, and how many go in one message.
            'max_kb' => 10240,
            'max' => 5,
            // The kinds taken. Never anything a browser would run (html, svg, js).
            'types' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt', 'csv', 'docx', 'xlsx'],
        ],
    ],

];
