<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>aparté for Laravel</title>
</head>
<body style="margin: 0">
    {{-- The README's "A list of conversations", with "Conversations in your database". --}}
    <div class="aparte-app-shell" style="height: 100vh" wire:ignore>
        <aparte-sidebar>
            <div class="aparte-sidebar__header">
                <button type="button" class="aparte-btn aparte-btn--surface" data-aparte-new-chat>New chat</button>
            </div>
            <div class="aparte-sidebar__search">
                <input type="search" class="aparte-field" placeholder="Search chats" aria-label="Search chats" data-aparte-sidebar-search>
            </div>
            <div class="aparte-sidebar__body">
                <aparte-conversation-list manage></aparte-conversation-list>
            </div>
        </aparte-sidebar>
        <header class="aparte-app-header">
            <button type="button" class="aparte-btn aparte-app-header__toggle" data-aparte-sidebar-toggle>Chats</button>
            <span class="aparte-app-header__title" data-aparte-title>New chat</span>
        </header>
        <div class="aparte-app-shell__main">
            <x-aparte::chat endpoint="/chat" conversations="/chat/conversations" style="height: 100%" />
        </div>
    </div>
</body>
</html>
