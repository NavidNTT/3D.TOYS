<?php

namespace Tests\Unit;

use App\Support\Currency;
use App\Support\Money;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * The money contract, in isolation.
 *
 * The rule under test is not "format a number nicely" — it is "never invent an
 * amount". The bug these cases exist to prevent is a single silent cast:
 * `(int) 12.99` is `12`, and the storefront then rendered `۱۲ تومان` for a
 * product nobody had priced in toman. Every case below is either "this is an
 * exact integral toman amount" or "there is no amount to show".
 */
class MoneyTest extends TestCase
{
    public function test_it_reads_an_integral_stored_value_as_an_exact_integer(): void
    {
        // A DECIMAL column reports an integral amount with a zero fraction.
        $this->assertSame(1_299_000, Money::toAmount('1299000', Currency::IRT));
        $this->assertSame(1_299_000, Money::toAmount('1299000.00', Currency::IRT));
        $this->assertSame(1_299_000, Money::toAmount(1_299_000, Currency::IRT));
        $this->assertSame(1_299_000, Money::toAmount(1_299_000.0, Currency::IRT));
    }

    public function test_it_refuses_a_fractional_amount_instead_of_truncating_it(): void
    {
        $this->assertNull(Money::toAmount('12.99', Currency::IRT));
        $this->assertNull(Money::toAmount(12.99, Currency::IRT));
        $this->assertNull(Money::toAmount('189.99', Currency::IRT));

        // Stated explicitly, because this is the regression that matters.
        $this->assertNotSame(12, Money::toAmount('12.99', Currency::IRT));
    }

    public function test_it_refuses_an_amount_that_is_not_denominated_in_irt(): void
    {
        // A legacy USD row has no toman amount. That is the whole point.
        $this->assertNull(Money::toAmount('12.99', Currency::USD));
        $this->assertNull(Money::toAmount('1299000', Currency::USD));
        $this->assertNull(Money::toAmount('1299000', 'EUR'));
        $this->assertNull(Money::toAmount('1299000', null));
        $this->assertNull(Money::toAmount('1299000', ''));
    }

    public function test_it_accepts_a_lowercase_unit(): void
    {
        $this->assertSame(1_299_000, Money::toAmount('1299000', 'irt'));
        $this->assertSame(1_299_000, Money::toAmount('1299000', ' irt '));
    }

    public function test_it_refuses_negative_and_non_numeric_values(): void
    {
        $this->assertNull(Money::toAmount(-1, Currency::IRT));
        $this->assertNull(Money::toAmount('-1', Currency::IRT));
        $this->assertNull(Money::toAmount('abc', Currency::IRT));
        $this->assertNull(Money::toAmount('1e3', Currency::IRT));
        $this->assertNull(Money::toAmount('12abc', Currency::IRT));
        $this->assertNull(Money::toAmount('', Currency::IRT));
        $this->assertNull(Money::toAmount(null, Currency::IRT));
        $this->assertNull(Money::toAmount(true, Currency::IRT));
        $this->assertNull(Money::toAmount(INF, Currency::IRT));
    }

    public function test_zero_is_a_legitimate_amount(): void
    {
        $this->assertSame(0, Money::toAmount('0', Currency::IRT));
        $this->assertSame(0, Money::toAmount(0, Currency::IRT));
        $this->assertTrue(Money::isValidIrtAmount(0));
    }

    public function test_the_input_guard_rejects_a_decimal_amount(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessageMatches('/non-negative integers/');

        Money::fromInput('12.99');
    }

    public function test_the_input_guard_normalises_an_absent_amount(): void
    {
        $this->assertNull(Money::fromInput(null));
        $this->assertNull(Money::fromInput(''));
        $this->assertSame(1_299_000, Money::fromInput('1299000'));
        $this->assertSame(1_299_000, Money::fromInput(1_299_000));
    }

    public function test_it_preserves_a_legacy_amount_verbatim(): void
    {
        $this->assertSame('12.99', Money::legacyString('12.99'));
        $this->assertSame('189.99', Money::legacyString(189.99));
        $this->assertSame('1299000.00', Money::legacyString('1299000.00'));
        $this->assertNull(Money::legacyString(null));
        $this->assertNull(Money::legacyString('   '));
    }

    public function test_only_irt_is_sellable(): void
    {
        $this->assertTrue(Currency::isSellable('IRT'));
        $this->assertTrue(Currency::isSellable(' irt '));
        $this->assertFalse(Currency::isSellable('USD'));
        $this->assertFalse(Currency::isSellable('EUR'));
        $this->assertFalse(Currency::isSellable(null));
        $this->assertFalse(Currency::isSellable(''));
    }

    public function test_labels_never_present_a_foreign_currency_as_toman(): void
    {
        $this->assertSame('تومان', Currency::label('IRT'));
        $this->assertSame('دلار آمریکا', Currency::label('usd'));
        $this->assertStringNotContainsString('تومان', Currency::label('USD'));
        $this->assertSame('EUR', Currency::label('EUR'));
        $this->assertSame('', Currency::label(null));
    }
}
