<?php

namespace App\Exceptions;

use Exception;
use Throwable;

/**
 * Base class for expected, user-facing API failures.
 *
 * Anything extending this is rendered as the unified JSON envelope
 * ({success:false, message, data}) by the handler in bootstrap/app.php, so
 * services can simply throw instead of building HTTP responses.
 */
abstract class ApiException extends Exception
{
    /**
     * HTTP status code for this failure.
     */
    abstract public function status(): int;

    /**
     * Machine-readable context returned in the "data" key.
     *
     * @return array<string, mixed>|null
     */
    public function context(): ?array
    {
        return null;
    }

    public function __construct(string $message = '', int $code = 0, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
