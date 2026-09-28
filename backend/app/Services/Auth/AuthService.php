<?php

namespace App\Services\Auth;

use App\Enums\UserRole;
use App\Exceptions\InvalidOtpException;
use App\Models\User;

/**
 * Turns a verified phone number into an authenticated session token.
 */
class AuthService
{
    public function __construct(
        private readonly OtpService $otpService,
    ) {}

    /**
     * Verify an OTP and, on success, log the caller in.
     *
     * @return array{user: User, token: string}
     *
     * @throws InvalidOtpException
     */
    public function verifyAndLogin(string $phone, string $code): array
    {
        if (! $this->otpService->verifyCode($phone, $code)) {
            throw new InvalidOtpException;
        }

        return $this->loginOrRegister($phone);
    }

    /**
     * Find the account for this number or register a new customer, then issue
     * a Sanctum personal access token.
     *
     * The unique index on users.phone makes this safe under concurrent first
     * logins: the loser of the race fails the insert and firstOrCreate simply
     * reads the row the winner created.
     *
     * @return array{user: User, token: string}
     */
    public function loginOrRegister(string $phone): array
    {
        $user = User::query()->firstOrCreate(
            ['phone' => $phone],
            ['role' => UserRole::Customer],
        );

        // Personal access token, not a session: stateless API auth that the
        // client sends as `Authorization: Bearer <token>`.
        $token = $user->createToken('auth-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
