<?php

namespace Aparte\Laravel\Streaming;

use Closure;
use Generator;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Laravel\Ai\Exceptions\ApprovalMismatchException;
use Laravel\Ai\Exceptions\InsufficientCreditsException;
use Laravel\Ai\Exceptions\ProviderConnectionException;
use Laravel\Ai\Exceptions\ProviderOverloadedException;
use Laravel\Ai\Exceptions\RateLimitedException;
use Laravel\Ai\Streaming\Events\ToolApprovalRequest;
use Laravel\Ai\Streaming\Protocols\AgentUserInteractionProtocol;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class AparteProtocol extends AgentUserInteractionProtocol
{
    /**
     * What the app makes of a failed run, given by describeErrorsUsing().
     *
     * @var (Closure(Throwable, Request, array{message: string, code?: string}): (array<string, mixed>|null))|null
     */
    protected static ?Closure $describeErrors = null;

    public function __construct(?string $threadId = null, ?string $runId = null, protected ?Request $request = null)
    {
        parent::__construct($threadId, $runId);
    }

    /**
     * Decide what the browser learns of a run that failed. The callback receives the exception,
     * the request, and what the package would send: `message` (masked unless APP_DEBUG is on)
     * and, when the exception names one, `code`, one of aparté's error codes. It returns the
     * keys it changes — a `code` set to null is not sent — or null to send the package's own.
     * What it returns reaches the browser's console and is stored with the conversation: the
     * chat's card says the sentence of the code, in the reader's language.
     */
    public static function describeErrorsUsing(?Closure $callback): void
    {
        static::$describeErrors = $callback;
    }

    /**
     * The SDK sends "An error occurred." for any exception and reports it to the log. Here the
     * browser also gets one of aparté's error codes when the exception names what happened (a
     * rate limit, a refusal, a provider out of credits), so the chat says that, and with
     * APP_DEBUG on, the exception's class and message, as any Laravel request that fails in
     * debug mode shows its exception. The app can decide otherwise with describeErrorsUsing().
     */
    protected function maskedErrorParts(): Generator
    {
        if ($this->finished || $this->exception === null || $this->exception instanceof ApprovalMismatchException) {
            yield from parent::maskedErrorParts();

            return;
        }

        yield from $this->yieldPart(['type' => 'RUN_ERROR', ...$this->describe($this->exception)]);
    }

    /**
     * What the browser is told of the exception: the package's own description, with what the
     * app's callback changed in it. A callback that throws is reported and changes nothing.
     *
     * @return array{message: string, code?: string}
     */
    protected function describe(Throwable $exception): array
    {
        $code = static::codeFor($exception);
        $default = [
            'message' => config('app.debug') ? get_class($exception).': '.$exception->getMessage() : 'An error occurred.',
            ...($code !== null ? ['code' => $code] : []),
        ];

        if (static::$describeErrors === null) {
            return $default;
        }

        try {
            $given = (static::$describeErrors)($exception, $this->request ?? request(), $default);
        } catch (Throwable $thrown) {
            report($thrown);

            return $default;
        }

        if (! is_array($given)) {
            return $default;
        }

        $error = $default;
        if (is_string($given['message'] ?? null) && $given['message'] !== '') {
            $error['message'] = $given['message'];
        }
        if (array_key_exists('code', $given) && $given['code'] === null) {
            unset($error['code']);
        } elseif (is_string($given['code'] ?? null) && $given['code'] !== '') {
            $error['code'] = $given['code'];
        }

        return $error;
    }

    /**
     * One of aparté's error codes, when the exception says what happened: the SDK's own for a
     * provider's answer, Laravel's for a refusal, and an HTTP status as aparté reads one.
     */
    protected static function codeFor(Throwable $exception): ?string
    {
        return match (true) {
            $exception instanceof RateLimitedException => 'USAGE_RATE_LIMIT',
            $exception instanceof ProviderOverloadedException => 'PROVIDER_UNAVAILABLE',
            $exception instanceof InsufficientCreditsException => 'PROVIDER_MISCONFIGURED',
            $exception instanceof ProviderConnectionException => 'NET_ERROR',
            $exception instanceof AuthorizationException, $exception instanceof AuthenticationException => 'CONFIG_INVALID_KEY',
            $exception instanceof HttpExceptionInterface => static::codeForStatus($exception->getStatusCode()),
            default => null,
        };
    }

    /** An HTTP status as aparté's client reads one (`AparteError.codeForStatus`). */
    protected static function codeForStatus(int $status): ?string
    {
        return match (true) {
            $status === 400 => 'USAGE_BAD_REQUEST',
            $status === 401, $status === 403 => 'CONFIG_INVALID_KEY',
            $status === 408 => 'NET_TIMEOUT',
            $status === 429 => 'USAGE_RATE_LIMIT',
            $status === 503 => 'PROVIDER_UNAVAILABLE',
            $status >= 500 => 'PROVIDER_ERROR',
            default => null,
        };
    }

    /**
     * The SDK names its approval interrupts `approval_required`. aparté's AG-UI runner
     * opens its approval panel on `tool_call`, the reason AG-UI agents commonly send.
     */
    protected function interrupts(ToolApprovalRequest $event): array
    {
        return array_map(
            fn (array $interrupt): array => ['reason' => 'tool_call'] + $interrupt,
            parent::interrupts($event),
        );
    }

    /**
     * The SDK ends a run with the ids of the messages it stored. AG-UI 1.0 describes no such
     * field on RUN_FINISHED, and aparté's runner drops each with a warning in the browser's
     * console: two per reply, about something the chat does not read.
     */
    protected function runFinishedPart(array $attributes = []): array
    {
        $part = parent::runFinishedPart($attributes);
        unset($part['messageId'], $part['userMessageId']);

        return $part;
    }
}
