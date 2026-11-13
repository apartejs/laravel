<?php

namespace Workbench\App\Providers;

use Illuminate\Support\ServiceProvider;
use Workbench\App\Ai\Assistant;

class WorkbenchServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Served by several workers on one SQLite file: a write waits for the one before it
        // rather than failing on a locked database.
        config(['database.connections.sqlite.busy_timeout' => 5000]);
    }

    public function boot(): void
    {
        // No model behind this app: the agent answers the same sentence, through the SDK's own
        // stream, its memory and its tables. A request is a new process, so one answer is enough.
        Assistant::fake(['A reply from the Laravel app.']);
    }
}
