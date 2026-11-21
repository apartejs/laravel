<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>aparté for Laravel</title>
</head>
<body style="margin: 0">
    {{-- The README's "Files": the model reads the images a person attaches, and the conversation keeps a picture of them. --}}
    <x-aparte::chat endpoint="/chat" conversations="/chat/conversations" files style="height: 100vh" />
</body>
</html>
