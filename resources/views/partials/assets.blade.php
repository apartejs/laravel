@once
    <link rel="stylesheet" href="{{ route('aparte.asset', ['file' => 'aparte.css', 'v' => \Aparte\Laravel\AparteServiceProvider::assetVersion('aparte.css')]) }}">
    <script type="module" src="{{ route('aparte.asset', ['file' => 'aparte.js', 'v' => \Aparte\Laravel\AparteServiceProvider::assetVersion('aparte.js')]) }}"></script>
@endonce
