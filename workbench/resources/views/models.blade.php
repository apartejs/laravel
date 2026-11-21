<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>aparté for Laravel</title>
</head>
<body style="margin: 0">
    {{-- The README's "Choosing the model": its route offers the models of config('aparte.models'), so the chat draws them. --}}
    <x-aparte::chat endpoint="/chat-models" style="height: 100vh" />
</body>
</html>
