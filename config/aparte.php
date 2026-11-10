<?php

return [

    // Where the chat's JavaScript and CSS come from.
    // 'bundle': the package serves its own built copy; nothing to install or build.
    // 'vite': your app builds it with its own Vite, so it can add aparté's plugins
    // with onAparteSetup (see the README, "Plugins").
    'assets' => env('APARTE_ASSETS', 'bundle'),

];
