<?php

namespace Aparte\Laravel\Http;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AssetController
{
    public function __invoke(string $file): BinaryFileResponse
    {
        return response()->file(__DIR__.'/../../dist/'.$file, [
            'Content-Type' => str_ends_with($file, '.css') ? 'text/css' : 'text/javascript',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
