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
        // What one visitor (one IP) may post a minute to the people routes: messages, hand-offs,
        // e-mail, rating; typing and "seen" have five times as much. null: no limit from here.
        'throttle' => 20,

        // How many days a conversation's hand-off, e-mail address and rating are kept in the cache.
        'keep_days' => 90,

        'files' => [
            // Off until you turn it on: the person can then send files while your team is in the
            // conversation (`:people-files="true"` on the chat shows the paperclip).
            'enabled' => (bool) env('APARTE_PEOPLE_FILES', false),
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
