<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\Support\InteractsWithSmsGateway;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use InteractsWithSmsGateway, RefreshDatabase;

    private const ME = '/api/v1/auth/me';

    private const LOGOUT = '/api/v1/auth/logout';

    public function test_me_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create(['name' => 'زهرا محمدی']);
        $token = $user->createToken('auth-token')->plainTextToken;

        $this->withToken($token)
            ->getJson(self::ME)
            ->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'name' => 'زهرا محمدی',
                    'phone' => $user->phone,
                    'role' => 'customer',
                ],
            ]);
    }

    public function test_me_requires_a_token(): void
    {
        $this->getJson(self::ME)
            ->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'برای دسترسی به این بخش باید وارد حساب خود شوید.',
            ]);
    }

    public function test_me_rejects_a_bogus_token(): void
    {
        $this->withToken('not-a-real-token')
            ->getJson(self::ME)
            ->assertStatus(401);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();

        $phoneToken = $user->createToken('auth-token')->plainTextToken;
        $tabletToken = $user->createToken('auth-token')->plainTextToken;

        $this->withToken($phoneToken)
            ->postJson(self::LOGOUT)
            ->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'با موفقیت خارج شدید.',
            ]);

        $this->forgetResolvedGuards();

        // Revoked token is dead...
        $this->withToken($phoneToken)->getJson(self::ME)->assertStatus(401);

        $this->forgetResolvedGuards();

        // ...the other device stays logged in.
        $this->withToken($tabletToken)->getJson(self::ME)->assertOk();

        $this->assertSame(1, PersonalAccessToken::query()->count());
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson(self::LOGOUT)->assertStatus(401);
    }

    public function test_a_full_login_then_logout_cycle_works(): void
    {
        $sms = $this->fakeSmsGateway();

        $this->postJson('/api/v1/auth/otp/send', ['phone' => '09129999999'])->assertOk();

        $login = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '09129999999',
            'code' => $sms->lastCode(),
        ])->assertOk();

        $token = $login->json('data.token');

        $this->withToken($token)->getJson(self::ME)->assertOk();
        $this->withToken($token)->postJson(self::LOGOUT)->assertOk();

        $this->forgetResolvedGuards();

        $this->withToken($token)->getJson(self::ME)->assertStatus(401);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    /**
     * Drop the guards resolved earlier in this test.
     *
     * Every test request reuses one application instance, and Laravel's
     * RequestGuard memoises the user it resolved. In production each HTTP
     * request boots a fresh application, so the revoked token is re-checked
     * against the database — which is what this call simulates.
     */
    private function forgetResolvedGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
