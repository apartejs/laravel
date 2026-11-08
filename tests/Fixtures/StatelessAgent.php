<?php

namespace Aparte\Laravel\Tests\Fixtures;

use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;

class StatelessAgent implements Agent
{
    use Promptable;

    public function instructions(): string
    {
        return 'You forget everything.';
    }
}
