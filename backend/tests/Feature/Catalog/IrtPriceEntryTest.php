<?php

namespace Tests\Feature\Catalog;

use App\Filament\Resources\ProductResource\Pages\CreateProduct;
use App\Models\Product;
use App\Models\User;
use App\Support\Money;
use Filament\Facades\Filament;
use Filament\Pages\Auth\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Livewire\Livewire;
use Symfony\Component\Finder\Finder;
use Tests\TestCase;

/**
 * The price contract at the point of entry: the administrator types toman, and
 * that exact number is what gets stored, served and charged.
 *
 * The rule this file exists to defend is narrow and absolute — **the panel never
 * converts a price**. No rate, no multiplier, no "USD field plus a calculator".
 * The product's price is whatever the admin decided, once, in the store's only
 * sellable currency.
 *
 * These tests deliberately do not re-prove what `ProductMoneyContractTest` and
 * `MoneyTest` already cover (that a legacy `12.99 USD` renders as `null` and not
 * `12`). They cover the *entry* path instead:
 *
 *  - a typed amount is stored and served verbatim (a rate would show up here),
 *  - no exchange-rate machinery exists to be invoked in the first place,
 *  - a USD row can never become sellable by being given a sellable-looking number,
 *  - the panel form refuses decimals and blanks,
 *  - the panel login itself works (without which none of the above is reachable),
 *  - and a legacy USD row is untouched by any of it.
 */
class IrtPriceEntryTest extends TestCase
{
    use RefreshDatabase;

    private const PRODUCTS = '/api/v1/products';

    protected function setUp(): void
    {
        parent::setUp();

        // Filament resolves the panel's auth guard from the "current" panel;
        // without this the resource pages and the login page have no panel to
        // belong to.
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    /**
     * The typed number and the stored number are the same number.
     *
     * The amounts are chosen so that a conversion would be visible: `100`
     * multiplied by any plausible rate (10, 100, 1_000, 100_000) lands on a
     * different figure than `100`.
     */
    public function test_a_price_typed_in_toman_is_stored_and_served_verbatim(): void
    {
        foreach ([0, 100, 2_500_000, 12_990_000] as $amount) {
            $slug = 'irt-'.$amount;

            $product = Product::factory()->create([
                'slug' => $slug,
                'price' => $amount,
                'currency' => 'IRT',
            ]);

            // 1. The column holds exactly what was typed — read straight from the
            //    query builder, so no model accessor can hide a transformation.
            $this->assertSame(
                $amount,
                (int) DB::table('products')->where('id', $product->id)->value('price'),
                "Stored price for {$amount} toman was altered on the way in.",
            );

            // 2. The API serves the same integer, with its own currency, in the
            //    payload the storefront and the cart both read.
            $this->getJson(self::PRODUCTS.'/'.$slug)
                ->assertOk()
                ->assertJsonPath('data.price', $amount)
                ->assertJsonPath('data.currency', 'IRT')
                ->assertJsonPath('data.purchasable', true)
                ->assertJsonPath('data.legacy_price', null);
        }
    }

    /**
     * There is no exchange-rate mechanism to invoke.
     *
     * A behavioural test can only catch a conversion that changes the stored
     * number. This one closes the other half: it fails the moment a rate, a rate
     * table, a rate service or a `usd_to_irt` helper is introduced anywhere in
     * the application, so the forbidden strategy cannot be added quietly and then
     * relied upon.
     */
    public function test_no_exchange_rate_machinery_exists_in_the_application(): void
    {
        $offenders = [];

        foreach ([app_path(), config_path()] as $root) {
            foreach (Finder::create()->files()->in($root)->name('*.php') as $file) {
                $contents = (string) file_get_contents($file->getRealPath());

                if (preg_match('/exchange|\busd_to_irt\b|\birt_rate\b/i', $contents) === 1) {
                    $offenders[] = $file->getRelativePathname();
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            'A price must be entered directly in toman; no exchange-rate code may exist in app/ or config/.',
        );
    }

    /**
     * A USD amount is not toman, no matter how toman-like the digits look.
     *
     * This is the "an IRT product cannot be saved with USD currency" rule from
     * the other direction: the panel offers toman only, and even a row that does
     * carry USD (the six preserved legacy rows) refuses to report a chargeable
     * amount. There is no state in which a dollar figure becomes a price in
     * toman without an explicit, approved, human-entered toman amount.
     */
    public function test_a_usd_currency_row_can_never_be_saleable(): void
    {
        $product = Product::factory()->create([
            'slug' => 'dollars-only',
            'price' => 1_299_000,
            'currency' => 'USD',
        ]);

        $fresh = $product->fresh();

        $this->assertNull($fresh->price, 'A USD row must expose no toman amount.');
        $this->assertFalse($fresh->purchasable());

        $this->getJson(self::PRODUCTS.'/dollars-only')
            ->assertOk()
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.currency', 'USD')
            ->assertJsonPath('data.purchasable', false);

        // Ordering is a separate gate and must agree with the payload.
        $this->assertSame(
            'USD',
            (string) DB::table('products')->where('id', $product->id)->value('currency'),
            'The stored currency label itself is preserved, not rewritten.',
        );
    }

    /**
     * A product created through the panel keeps the administrator's number.
     *
     * This is the whole business requirement in one assertion: fill the real
     * Filament create form with `2_500_000`, and the row that lands in the
     * database holds `2500000`.
     */
    public function test_the_admin_form_stores_the_typed_toman_amount_unchanged(): void
    {
        Livewire::test(CreateProduct::class)
            ->fillForm([
                'title' => 'Toy Robot',
                'slug' => 'toy-robot',
                'price' => 2_500_000,
                'currency' => 'IRT',
                'stock' => 3,
                'is_active' => true,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $created = Product::query()->where('slug', 'toy-robot')->sole();

        $this->assertSame(2_500_000, $created->price);
        $this->assertSame('IRT', $created->currency);
        $this->assertTrue($created->purchasable());
    }

    /**
     * A decimal or a blank is refused at entry rather than rounded or stored.
     *
     * `12.99` becoming `12` is the original money bug; `12.99` toman is simply
     * not an amount, and a saleable product without an amount is not sellable.
     */
    public function test_the_admin_form_refuses_a_decimal_price_and_a_blank_price(): void
    {
        $base = [
            'title' => 'Badly Priced Toy',
            'slug' => 'badly-priced-toy',
            'currency' => 'IRT',
            'stock' => 1,
            'is_active' => true,
        ];

        Livewire::test(CreateProduct::class)
            ->fillForm($base + ['price' => '12.99'])
            ->call('create')
            ->assertHasFormErrors(['price']);

        Livewire::test(CreateProduct::class)
            ->fillForm($base + ['slug' => 'no-price-toy', 'price' => ''])
            ->call('create')
            ->assertHasFormErrors(['price']);

        $this->assertSame(0, Product::query()->count(), 'No invalid row may be stored.');
    }

    /**
     * The panel cannot express a dollar price for a saleable product.
     *
     * The currency select offers `IRT` alone, so `USD` is not a value the form
     * can submit — the request is rejected instead of being silently coerced to
     * a currency or a converted amount.
     */
    public function test_the_admin_form_cannot_submit_a_usd_currency(): void
    {
        Livewire::test(CreateProduct::class)
            ->fillForm([
                'title' => 'Priced In Dollars',
                'slug' => 'priced-in-dollars',
                'price' => 1_299_000,
                'currency' => 'USD',
                'stock' => 1,
                'is_active' => true,
            ])
            ->call('create')
            ->assertHasFormErrors(['currency']);

        $this->assertSame(0, Product::query()->count());
    }

    /**
     * The panel is reachable: an administrator can actually log in.
     *
     * This is not decoration. The panel's login page authenticates an
     * email + password pair, and before this change the `users` table had
     * neither column, so `Auth::attempt` threw `Unknown column 'email'` and no
     * one could enter `/admin` at all — which made every other rule in this file
     * unenforceable in practice.
     */
    public function test_an_administrator_can_log_into_the_panel(): void
    {
        $admin = User::factory()->admin()->create(['phone' => '09120000000']);

        $this->assertNotNull($admin->email);
        $this->assertSame($admin->email, 'admin@toy-store.local');

        Livewire::test(Login::class)
            ->fillForm([
                'email' => 'admin@toy-store.local',
                'password' => 'password',
            ])
            ->call('authenticate');

        $this->assertTrue(Auth::check(), 'The seeded administrator must be able to authenticate.');
        $this->assertSame($admin->id, Auth::id());
    }

    /**
     * …and a customer cannot, even with the right password.
     *
     * Access is the administrator role, not the possession of credentials: the
     * storefront's customers have no email and no password, and the panel refuses
     * an account whose role is not admin.
     */
    public function test_a_customer_cannot_log_into_the_panel(): void
    {
        $customer = User::factory()->create([
            'phone' => '09121111111',
            'email' => 'customer@toy-store.local',
            'password' => 'password',
        ]);

        Livewire::test(Login::class)
            ->fillForm([
                'email' => 'customer@toy-store.local',
                'password' => 'password',
            ])
            ->call('authenticate')
            ->assertHasFormErrors(['email']);

        $this->assertFalse(Auth::check(), 'A customer session must never be established.');
        $this->assertFalse($customer->canAccessPanel(Filament::getPanel('admin')));
    }

    /**
     * Bootstrapping a panel login is a hashing operation, never a conversion.
     *
     * Guards the one seam where an operator sets a password by hand: the model's
     * `hashed` cast stores a hash, and the plaintext value is never written to
     * the column (a leaked column must not be a leaked password).
     */
    public function test_a_panel_password_is_stored_hashed(): void
    {
        $admin = User::factory()->admin()->create(['phone' => '09120000000']);
        $stored = (string) DB::table('users')->where('id', $admin->id)->value('password');

        $this->assertNotSame('password', $stored);
        $this->assertStringStartsWith('$2y$', $stored, 'The `hashed` cast must produce a bcrypt hash.');
        $this->assertTrue(password_verify('password', $stored));

        // The hash never reaches an API payload or a serialised model.
        $this->assertArrayNotHasKey('password', $admin->toArray());
        $this->assertArrayNotHasKey('remember_token', $admin->toArray());
    }

    /**
     * Adding toman prices does not disturb the quarantined legacy rows.
     *
     * A legacy row is written the way the pre-contract schema allowed it (a raw
     * insert, since the model now refuses a decimal), then an unrelated IRT
     * product is created through the panel. The legacy row's price, currency and
     * preserved amount must be byte-identical afterwards.
     */
    public function test_a_legacy_usd_row_is_untouched_by_new_toman_entries(): void
    {
        DB::table('products')->insert([
            'title' => 'Legacy Submarine',
            'slug' => 'legacy-submarine',
            'price' => '48.25',
            'compare_at_price' => '64.00',
            'currency' => 'USD',
            'stock' => 5,
            'is_active' => 1,
            'attributes' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $before = (array) DB::table('products')->where('slug', 'legacy-submarine')->first();

        Livewire::test(CreateProduct::class)
            ->fillForm([
                'title' => 'Fresh Toman Toy',
                'slug' => 'fresh-toman-toy',
                'price' => 999_000,
                'currency' => 'IRT',
                'stock' => 2,
                'is_active' => true,
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $after = (array) DB::table('products')->where('slug', 'legacy-submarine')->first();

        $this->assertSame($before, $after, 'A legacy USD row must not be rewritten by a toman entry.');
        $this->assertSame('USD', $after['currency']);

        // The amount itself is asserted through the model, which is the reader
        // the rest of the application uses. (The raw column value is only
        // compared as "identical to itself" above on purpose: SQLite's numeric
        // affinity hands `48.25` back as a float, so a raw string comparison
        // here would be a statement about the database driver, not the data.)
        $legacy = Product::query()->where('slug', 'legacy-submarine')->sole();
        $this->assertFalse($legacy->purchasable());
        $this->assertNull($legacy->price);
        $this->assertSame('48.25', $legacy->legacyAmount());
        $this->assertSame('USD', $legacy->legacyCurrency());
    }

    /**
     * The model setter is the last line of defence for the same rules.
     *
     * The form is the only write path today, but the model must not accept a
     * decimal from anywhere else (`Money::fromInput` throws instead of rounding).
     */
    public function test_the_model_setter_still_refuses_a_decimal_amount(): void
    {
        $this->assertTrue(Money::isValidIrtAmount('1299000'));
        $this->assertFalse(Money::isValidIrtAmount('12.99'));

        $this->expectException(InvalidArgumentException::class);

        Product::factory()->create(['slug' => 'decimal-price', 'price' => 12.99]);
    }
}
