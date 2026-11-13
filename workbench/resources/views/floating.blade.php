<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>aparté for Laravel</title>
</head>
<body style="margin: 0; font-family: system-ui, sans-serif">
    <main style="padding: 40px">
        <h1>Orders</h1>
        <p>A page of the app, with the chat in its corner.</p>
    </main>

    <x-aparte::launcher endpoint="/chat" conversations="/chat/conversations" label="Chat" maximizable />
</body>
</html>
