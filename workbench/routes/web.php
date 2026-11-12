<?php

use Illuminate\Foundation\Auth\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Workbench\App\Ai\Assistant;

// A test app: whoever asks is signed in as that person.
Route::get('/sign-in/{id}', function (int $id) {
    $person = User::query()->find($id);
    if ($person === null) {
        $person = (new User)->forceFill([
            'id' => $id,
            'name' => "Person $id",
            'email' => "person$id@example.test",
            'password' => 'not-a-password',
        ]);
        $person->save();
    }
    Auth::login($person);

    return redirect('/');
})->name('login');

Route::get('/sign-out', function () {
    Auth::logout();

    return redirect('/');
});

// The README's two pages: the chat with its list, and the floating chat.
Route::view('/', 'page');
Route::view('/floating', 'floating');

Route::middleware('auth')->group(function () {
    Route::aparte('/chat', Assistant::class);
    Route::aparteConversations('/chat/conversations');

    // What the database holds for the person signed in, for the browser test to read.
    Route::get('/state', fn (Request $request) => [
        'kept' => DB::table('aparte_conversations')->where('owner_id', (string) $request->user()->getKey())->count(),
        'memory' => DB::table('agent_conversations')->where('participant_id', $request->user()->getKey())->count(),
        'messages' => DB::table('agent_conversation_messages')->where('participant_id', $request->user()->getKey())->count(),
    ]);
});
