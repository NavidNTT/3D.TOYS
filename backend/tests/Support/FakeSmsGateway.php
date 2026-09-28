<?php

namespace Tests\Support;

use App\Services\Sms\Contracts\SmsGatewayInterface;

/**
 * In-memory SMS gateway.
 *
 * Records what the application *tried* to send, which is how the tests learn
 * the plaintext OTP (it is deliberately unavailable anywhere else — the
 * database only holds its hash).
 */
class FakeSmsGateway implements SmsGatewayInterface
{
    /**
     * @var list<array{phone: string, code: string}>
     */
    public array $sent = [];

    private bool $shouldFail = false;

    public function sendOtp(string $phone, string $code): bool
    {
        if ($this->shouldFail) {
            return false;
        }

        $this->sent[] = ['phone' => $phone, 'code' => $code];

        return true;
    }

    /**
     * Simulate a provider outage.
     */
    public function fail(): static
    {
        $this->shouldFail = true;

        return $this;
    }

    public function lastCode(): ?string
    {
        if ($this->sent === []) {
            return null;
        }

        return $this->sent[array_key_last($this->sent)]['code'];
    }

    public function lastCodeFor(string $phone): ?string
    {
        foreach (array_reverse($this->sent) as $message) {
            if ($message['phone'] === $phone) {
                return $message['code'];
            }
        }

        return null;
    }

    public function count(): int
    {
        return count($this->sent);
    }
}
