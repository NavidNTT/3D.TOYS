<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithSmsGateway;
use Tests\TestCase;

class VerifyOtpTest extends TestCase
{
    use InteractsWithSmsGateway, RefreshDatabase;

    private const SEND = '/api/v1/auth/otp/send';

    private const VERIFY = '/api/v1/auth/otp/verify';

    private const PHONE = '09121234567';

    /**
     * Walk the real send endpoint so the stored hash matches the delivered code.
     */
    private function requestOtp(string $phone = self::PHONE): string
    {
        $this->postJson(self::SEND, ['phone' => $phone])->assertOk();

        return $this->sms->lastCodeFor($phone);
    }

    public function test_a_new_user_is_registered_and_receives_a_working_token(): void
    {
        $this->fakeSmsGateway();
        $code = $this->requestOtp();

        $response = $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'ورود با موفقیت انجام شد.',
            ])
            ->assertJsonPath('data.user.phone', self::PHONE)
            ->assertJsonPath('data.user.role', 'customer')
            ->assertJsonPath('data.user.name', null)
            ->assertJsonPath('data.token_type', 'Bearer')
            ->assertJsonStructure(['data' => ['user' => ['id', 'name', 'phone', 'role'], 'token']]);

        $user = User::query()->where('phone', self::PHONE)->sole();

        $this->assertSame(UserRole::Customer, $user->role);
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class,
            'name' => 'auth-token',
        ]);

        // The returned token really authenticates.
        $this->withToken($response->json('data.token'))
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    }

    public function test_an_existing_user_logs_in_without_being_duplicated(): void
    {
        $this->fakeSmsGateway();

        $user = User::factory()->create([
            'phone' => self::PHONE,
            'name' => 'علی رضایی',
        ]);

        $code = $this->requestOtp();

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.name', 'علی رضایی');

        $this->assertSame(1, User::query()->count());
    }

    public function test_the_code_can_only_be_used_once(): void
    {
        $this->fakeSmsGateway();
        $code = $this->requestOtp();

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])->assertOk();

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('data.reason', 'invalid_otp');

        $this->assertDatabaseCount('otp_codes', 0);
    }

    public function test_an_invalid_code_is_rejected_without_issuing_a_token(): void
    {
        $this->fakeSmsGateway();
        $code = $this->requestOtp();

        $wrong = $code === '11111' ? '22222' : '11111';

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $wrong])
            ->assertStatus(422)
            ->assertJson([
                'success' => false,
                'message' => 'کد تأیید نامعتبر یا منقضی شده است.',
            ])
            ->assertJsonPath('data.reason', 'invalid_otp');

        $this->assertDatabaseCount('personal_access_tokens', 0);
        // The legitimate challenge survives a wrong guess.
        $this->assertDatabaseCount('otp_codes', 1);
    }

    public function test_an_expired_code_is_rejected(): void
    {
        $this->fakeSmsGateway();
        $code = $this->requestOtp();

        $this->travel(3)->minutes();

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])
            ->assertStatus(422)
            ->assertJsonPath('data.reason', 'invalid_otp');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_a_code_issued_to_another_number_cannot_be_used(): void
    {
        $this->fakeSmsGateway();
        $code = $this->requestOtp('09120000009');

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])
            ->assertStatus(422);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_verifying_without_a_challenge_fails(): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => '12345'])
            ->assertStatus(422)
            ->assertJsonPath('data.reason', 'invalid_otp');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    #[DataProvider('malformedCodes')]
    public function test_it_validates_the_code_shape(mixed $code): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => $code])
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonStructure(['success', 'message', 'data' => ['code']]);
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function malformedCodes(): array
    {
        return [
            'missing' => [null],
            'too short' => ['1234'],
            'too long' => ['123456'],
            'letters' => ['abcde'],
            'mixed' => ['12a45'],
            'persian digits' => ['۱۲۳۴۵'],
            'integer' => [12345],
        ];
    }

    public function test_it_rejects_an_invalid_phone_number(): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::VERIFY, ['phone' => '12345', 'code' => '12345'])
            ->assertStatus(422)
            ->assertJsonStructure(['success', 'message', 'data' => ['phone']]);
    }

    public function test_verify_is_throttled_against_brute_force(): void
    {
        $this->fakeSmsGateway();
        $this->requestOtp();

        // The limiter allows 10 attempts per minute per phone + IP.
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => '00000'])
                ->assertStatus(422);
        }

        $this->postJson(self::VERIFY, ['phone' => self::PHONE, 'code' => '00000'])
            ->assertStatus(429)
            ->assertJsonPath('data.reason', 'too_many_requests');
    }
}
