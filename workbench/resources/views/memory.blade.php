<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>aparté for Laravel</title>
</head>
<body style="margin: 0">
    {{-- The README's "Retrying and editing": the model's memory follows the branch on screen. --}}
    <x-aparte::chat endpoint="/chat" style="height: 100vh" />
    <script>
        document.addEventListener('aparte:setup', (event) => event.detail.config.setBubbleActions({ retry: true, edit: true }));
    </script>
</body>
</html>
