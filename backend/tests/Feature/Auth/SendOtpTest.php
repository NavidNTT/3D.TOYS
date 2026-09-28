<?php

namespace Tests\Feature\Auth;

use App\Models\OtpCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\InteractsWithSmsGateway;
use Tests\TestCase;

class SendOtpTest extends TestCase
{
    use InteractsWithSmsGateway, RefreshDatabase;

    private const ENDPOINT = '/api/v1/auth/otp/send';

    private const PHONE = '09121234567';

    public function test_it_sends_an_otp_to_a_valid_iranian_mobile_number(): void
    {
        $sms = $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])
            ->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'کد تأیید با موفقیت ارسال شد.',
                'data' => null,
            ]);

        $this->assertCount(1, $sms->sent);
        $this->assertSame(self::PHONE, $sms->sent[0]['phone']);
    }

    public function test_the_code_is_stored_hashed_and_never_in_plain_text(): void
    {
        $sms = $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();

        $otp = OtpCode::query()->where('phone', self::PHONE)->sole();
        $plain = $sms->lastCode();

        $this->assertNotSame($plain, $otp->code, 'The OTP must never be persisted in plain text.');
        $this->assertTrue(Hash::check($plain, $otp->code), 'The stored hash must verify the delivered code.');
        $this->assertMatchesRegularExpression('/^[0-9]{5}$/', $plain);
    }

    public function test_the_code_expires_two_minutes_after_issue(): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();

        $otp = OtpCode::query()->where('phone', self::PHONE)->sole();

        $this->assertTrue(
            $otp->expires_at->between(now()->addMinutes(2)->subSeconds(5), now()->addMinutes(2)->addSeconds(5)),
            'OTP validity should be the configured 2 minutes.',
        );
        $this->assertFalse($otp->isExpired());
    }

    public function test_the_response_never_leaks_the_code(): void
    {
        $sms = $this->fakeSmsGateway();

        $response = $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();

        $this->assertStringNotContainsString($sms->lastCode(), $response->getContent());
    }

    public function test_requesting_a_second_code_invalidates_the_first(): void
    {
        $sms = $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();
        $first = $sms->lastCode();

        $this->travel(3)->minutes();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();

        // Exactly one live challenge per phone number.
        $this->assertSame(1, OtpCode::query()->where('phone', self::PHONE)->count());

        $stored = OtpCode::query()->where('phone', self::PHONE)->sole();
        $this->assertTrue(Hash::check($sms->lastCode(), $stored->code));
        $this->assertFalse(
            Hash::check($first, $stored->code) && $first !== $sms->lastCode(),
            'The superseded code must no longer be valid.',
        );
    }

    public function test_it_reports_a_gateway_failure_and_leaves_no_code_behind(): void
    {
        $this->fakeSmsGateway()->fail();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])
            ->assertStatus(502)
            ->assertJson([
                'success' => false,
                'message' => 'ارسال کد تأیید با خطا مواجه شد. لطفاً دوباره تلاش کنید.',
            ])
            ->assertJsonPath('data.reason', 'sms_delivery_failed');

        $this->assertDatabaseCount('otp_codes', 0);
    }

    #[DataProvider('invalidPhoneNumbers')]
    public function test_it_rejects_invalid_phone_numbers(mixed $phone): void
    {
        $sms = $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => $phone])
            ->assertStatus(422)
            ->assertJson(['success' => false])
            ->assertJsonStructure(['success', 'message', 'data' => ['phone']]);

        $this->assertCount(0, $sms->sent);
        $this->assertDatabaseCount('otp_codes', 0);
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function invalidPhoneNumbers(): array
    {
        return [
            'missing' => [null],
            'empty' => [''],
            'too short' => ['091234567'],
            'too long' => ['091234567890'],
            'no leading zero' => ['9123456789'],
            'international format' => ['+989123456789'],
            'landline' => ['08123456789'],
            'letters' => ['0912345678a'],
            'persian digits' => ['۰۹۱۲۳۴۵۶۷۸۹'],
            'integer' => [9123456789],
        ];
    }

    public function test_it_trims_surrounding_whitespace_before_validating(): void
    {
        $sms = $this->fakeSmsGateway();

        // Laravel's TrimStrings middleware normalises the payload, so a copied
        // and pasted number with spaces must still work — and must be stored
        // in its canonical form.
        $this->postJson(self::ENDPOINT, ['phone' => ' 09121234567 '])->assertOk();

        $this->assertSame(self::PHONE, $sms->sent[0]['phone']);
        $this->assertDatabaseHas('otp_codes', ['phone' => self::PHONE]);
    }

    public function test_it_throttles_a_second_request_within_two_minutes(): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])
            ->assertStatus(429)
            ->assertJson(['success' => false])
            ->assertJsonPath('data.reason', 'too_many_requests')
            ->assertHeader('Retry-After');

        $this->assertDatabaseCount('otp_codes', 1);
    }

    public function test_the_two_minute_window_releases_the_limit(): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();
        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertStatus(429);

        $this->travel(3)->minutes();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();
    }

    public function test_it_caps_requests_at_five_per_hour(): void
    {
        $sms = $this->fakeSmsGateway();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();
            // Stay outside the 2-minute window but inside the hour.
            $this->travel(3)->minutes();
        }

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertStatus(429);

        $this->assertCount(5, $sms->sent);
    }

    public function test_throttling_is_scoped_per_phone_number(): void
    {
        $this->fakeSmsGateway();

        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertOk();
        $this->postJson(self::ENDPOINT, ['phone' => self::PHONE])->assertStatus(429);

        // A different number from the same IP is unaffected.
        $this->postJson(self::ENDPOINT, ['phone' => '09120000001'])->assertOk();
    }
}
