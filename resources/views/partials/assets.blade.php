{{-- In Vite mode, the app's own build brings the chat's JavaScript and CSS. --}}
@unless (config('aparte.assets') === 'vite')
    @once
        <link rel="stylesheet" href="{{ route('aparte.asset', ['type' => 'css', 'v' => \Aparte\Laravel\AparteServiceProvider::assetVersion('css')]) }}">
        <script type="module" src="{{ route('aparte.asset', ['type' => 'js', 'v' => \Aparte\Laravel\AparteServiceProvider::assetVersion('js')]) }}"></script>
    @endonce
@endunless
