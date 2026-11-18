<?php

use Aparte\Laravel\People;
use Illuminate\Support\Facades\Blade;

/** The languages aparté's own words come in (@aparte/locales), English aside. */
const APARTE_LANGUAGES = ['de', 'es', 'fr', 'it', 'ja', 'ko', 'pt_BR', 'ru', 'zh_CN'];

/** Every line this package writes for a person to read, through __(). */
function packageLines(): array
{
    $lines = [];
    foreach ([...glob(__DIR__.'/../../src/{,*/,*/*/}*.php', GLOB_BRACE), ...glob(__DIR__.'/../../resources/views/{,*/}*.blade.php', GLOB_BRACE)] as $file) {
        preg_match_all('#__\(\'([^\']+)\'#', file_get_contents($file), $found);
        $lines = [...$lines, ...$found[1]];
    }

    return array_values(array_unique($lines));
}

it('gives the chat the page language, for its own words', function () {
    app()->setLocale('fr');

    expect(Blade::render('<x-aparte::chat endpoint="/chat" />'))->toContain('data-aparte-locale="fr"');
});

it('says its own lines in each of the languages aparté speaks', function (string $language) {
    $file = __DIR__."/../../lang/{$language}.json";
    expect($file)->toBeFile();

    $lines = json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR);
    $missing = array_values(array_diff(packageLines(), array_keys($lines)));
    expect($missing)->toBe([]);

    foreach ($lines as $english => $translated) {
        // The placeholders stay as they are: ":email" in, ":email" out.
        preg_match_all('/:[a-z]+/', $english, $in);
        preg_match_all('/:[a-z]+/', $translated, $out);
        expect($out[0])->toEqualCanonicalizing($in[0], "{$language}: {$english}");
    }
})->with(APARTE_LANGUAGES);

it('writes its notices in the language of the request', function () {
    app()->setLocale('fr');
    People::askRating('thread-1');

    People::rate('thread-1', 'up');

    expect(Blade::render('<x-aparte::chat endpoint="/chat" people="/chat/people" :people-rating="true" />'))
        ->toContain(e(__('How was this conversation?')))
        ->and(__('How was this conversation?'))->not->toBe('How was this conversation?')
        ->and(__('The assistant is back'))->not->toBe('The assistant is back');
});
