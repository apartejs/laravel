<?php

it('serves the bundle', function (string $path, string $type) {
    $response = $this->get('/aparte-assets/'.$path)->assertOk();

    expect($response->headers->get('Content-Type'))->toStartWith($type);
})->with([
    ['js', 'text/javascript'],
    ['css', 'text/css'],
]);

it('serves nothing else', function (string $path) {
    $this->get('/aparte-assets/'.$path)->assertNotFound();
})->with(['composer.json', '..%2Fcomposer.json', 'aparte.js', 'js.map']);
