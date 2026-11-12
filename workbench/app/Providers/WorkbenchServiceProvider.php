<?php

namespace Workbench\App\Providers;

use Illuminate\Support\ServiceProvider;
use Workbench\App\Ai\Assistant;

class WorkbenchServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // No model behind this app: the agent answers the same sentence, through the SDK's own
        // stream, its memory and its tables. A request is a new process, so one answer is enough.
        Assistant::fake(['A reply from the Laravel app.']);
    }
}
