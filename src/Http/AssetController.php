<?php

namespace Aparte\Laravel\Http;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AssetController
{
    public function __invoke(string $type): BinaryFileResponse
    {
        return response()->file(__DIR__.'/../../dist/aparte.'.$type, [
            'Content-Type' => $type === 'css' ? 'text/css' : 'text/javascript',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
