<?php

it('serves the bundle', function (string $file, string $type) {
    $response = $this->get('/aparte-assets/'.$file)->assertOk();

    expect($response->headers->get('Content-Type'))->toStartWith($type);
})->with([
    ['aparte.js', 'text/javascript'],
    ['aparte.css', 'text/css'],
]);

it('serves nothing else', function (string $path) {
    $this->get('/aparte-assets/'.$path)->assertNotFound();
})->with(['composer.json', '..%2Fcomposer.json', 'aparte.js.map']);
