<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Shelve the catalogued 3D products.
 *
 * The eight fixture products (`toys:ingest-3d`) were published before the
 * taxonomy had a shelf for a model car or a blaster, so they carried
 * `category_id = null`: reachable by their direct URL, invisible to every
 * category page. This command applies the mapping that now lives with the
 * fixtures — the `category` slug on each entry of config/media_ingest.php —
 * and nothing else.
 *
 * Three properties, in order of importance:
 *
 *  - **It writes exactly one column.** Every row is updated with
 *    `category_id` alone, through the query builder, so titles, slugs, prices,
 *    currencies, legacy amounts, stock, attributes and ids are untouched by
 *    construction. A row already pointing at the right category is not written
 *    at all.
 *  - **Idempotent.** Categories are matched by their unique slug and products by
 *    their unique slug, so re-running updates the same rows to the same values
 *    and creates neither a duplicate category nor a duplicate product.
 *  - **Readable before it writes.** The current state and the proposed mapping
 *    are printed first, and `--dry-run` stops after printing: an operator can
 *    see the whole change — and verify it is only a change of shelf — before it
 *    happens.
 *
 * Products that are not in the manifest (the hand-written catalogue) are
 * reported and deliberately left alone: this command restores the fixture
 * mapping, it does not re-merchandise the store.
 */
class AssignCatalogCategoriesCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'toys:assign-categories
                            {--dry-run : Print the current state and the proposed mapping without writing anything}';

    /**
     * @var string
     */
    protected $description = 'Assign the catalogued 3D products to their categories, idempotently';

    /**
     * Columns the before/after proof is taken over.
     *
     * Deliberately the product identity and every money-bearing column, plus
     * the columns the storefront reads: if a run of this command ever changed
     * one of them, the summary below would show it.
     *
     * @var list<string>
     */
    private const AUDITED_COLUMNS = [
        'id', 'slug', 'title', 'price', 'compare_at_price', 'currency',
        'legacy_price', 'legacy_compare_at_price', 'legacy_currency', 'stock', 'is_active',
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $taxonomy = $this->taxonomy();
        $mapping = $this->mapping($taxonomy);

        if ($mapping === []) {
            $this->error('Nothing to assign: config/media_ingest.php lists no product with a category.');

            return self::FAILURE;
        }

        // Taken unconditionally: reading the row state is free, and the audit
        // below is only meaningful against a snapshot from before the writes.
        $before = $this->audit();

        $this->printCurrentState();

        if (! $dryRun) {
            $this->ensureCategoriesExist($taxonomy);
        }

        $this->newLine();
        $this->line($dryRun
            ? '<info>Proposed mapping</info> (dry run — nothing will be written)'
            : '<info>Applying mapping</info>');

        [$changed, $unchanged, $missing] = $this->apply($mapping, $dryRun);

        $this->newLine();
        $this->line(sprintf(
            '<info>%d row(s) %s; %d already shelved; %d manifest product(s) not in this database.</info>',
            $changed,
            $dryRun ? 'would change' : 'changed',
            $unchanged,
            count($missing),
        ));

        foreach ($missing as $slug) {
            $this->line("  <comment>skip</comment> {$slug} does not exist yet — `toys:ingest-3d` creates it.");
        }

        if ($dryRun) {
            $this->line('<comment>Dry run: no category was created and no product was updated.</comment>');

            return self::SUCCESS;
        }

        $this->auditUntouched($before);
        $this->printCurrentState('State after the run');

        return self::SUCCESS;
    }

    /**
     * The taxonomy — the categories that are allowed to exist.
     *
     * @return list<array{slug: string, name: string, description?: string|null, theme_config?: array<string, mixed>|null}>
     */
    private function taxonomy(): array
    {
        /** @var list<array{slug: string, name: string, description?: string|null, theme_config?: array<string, mixed>|null}> $taxonomy */
        $taxonomy = array_values((array) config('catalog.categories', []));

        return $taxonomy;
    }

    /**
     * product slug → category slug, read from the fixture manifest.
     *
     * One source for both the ingest command and this backfill, so the two can
     * never disagree about where a fixture belongs.
     *
     * @param  list<array{slug: string, name: string}>  $taxonomy
     * @return list<array{product: string, category: string}>
     */
    private function mapping(array $taxonomy): array
    {
        $known = array_column($taxonomy, 'slug');

        /** @var list<array{slug: string, title: string, category?: string|null}> $entries */
        $entries = array_values((array) config('media_ingest.entries', []));
        $mapping = [];

        foreach ($entries as $entry) {
            $category = $entry['category'] ?? null;

            if ($category === null || $category === '') {
                continue;
            }

            // A typo here would shelve products somewhere the storefront cannot
            // navigate to, so it stops the run instead of being written.
            if (! in_array($category, $known, true)) {
                throw new RuntimeException(sprintf(
                    'Manifest entry [%s] names category [%s], which config/catalog.php does not define.',
                    $entry['slug'],
                    $category,
                ));
            }

            $mapping[] = [
                'product' => $entry['slug'],
                'category' => $category,
            ];
        }

        return $mapping;
    }

    /**
     * Create the taxonomy categories that are missing; leave existing ones ——
     * and the ids the storefront's URLs are built from — exactly as they are.
     *
     * @param  list<array{slug: string, name: string, description?: string|null, theme_config?: array<string, mixed>|null}>  $taxonomy
     */
    private function ensureCategoriesExist(array $taxonomy): void
    {
        foreach ($taxonomy as $category) {
            Category::query()->firstOrCreate(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'description' => $category['description'] ?? null,
                    'theme_config' => $category['theme_config'] ?? null,
                ],
            );
        }
    }

    /**
     * Write the mapping, one `category_id` per product.
     *
     * @param  list<array{product: string, category: string}>  $mapping
     * @return array{0: int, 1: int, 2: list<string>} changed, unchanged, missing product slugs
     */
    private function apply(array $mapping, bool $dryRun): array
    {
        $changed = 0;
        $unchanged = 0;
        $missing = [];

        foreach ($mapping as $row) {
            $product = Product::query()
                ->with('category:id,slug')
                ->where('slug', $row['product'])
                ->first(['id', 'category_id']);

            if ($product === null) {
                $missing[] = $row['product'];

                continue;
            }

            // Compared by slug rather than by id so a dry run is exact on a
            // database where the taxonomy has not been created yet.
            $current = $product->category?->slug;
            $alreadyShelved = $current === $row['category'];

            $this->line(sprintf(
                '  %s <comment>%s</comment> %s → <info>%s</info>%s',
                $alreadyShelved ? '·' : '→',
                $row['product'],
                $current ?? '(no category)',
                $row['category'],
                $alreadyShelved ? '  (already shelved)' : '',
            ));

            if ($alreadyShelved) {
                $unchanged++;

                continue;
            }

            $changed++;

            if ($dryRun) {
                continue;
            }

            $target = Category::query()->where('slug', $row['category'])->value('id');

            if ($target === null) {
                throw new RuntimeException(
                    "Category [{$row['category']}] is in the taxonomy but was not created."
                );
            }

            // Exactly one column, through the query builder: no accessor, no
            // cast and no observer sees this write, so nothing else on the row
            // can move.
            Product::query()->where('id', $product->id)->update(['category_id' => $target]);
        }

        return [$changed, $unchanged, $missing];
    }

    /**
     * Print what the store currently looks like: the taxonomy, which products
     * are shelved where, and which are not shelved at all.
     */
    private function printCurrentState(string $heading = 'Current state'): void
    {
        $this->newLine();
        $this->line("<info>{$heading}</info>");

        $categories = Category::query()->orderBy('id')->get(['id', 'slug', 'name']);
        $counts = Product::query()
            ->selectRaw('category_id, count(*) as total')
            ->groupBy('category_id')
            ->pluck('total', 'category_id');

        $this->table(
            ['Category id', 'Slug', 'Name', 'Products'],
            $categories->map(fn (Category $category): array => [
                $category->id,
                $category->slug,
                $category->name,
                (int) ($counts[$category->id] ?? 0),
            ])->all(),
        );

        $uncategorised = Product::query()
            ->whereNull('category_id')
            ->orderBy('id')
            ->pluck('slug')
            ->all();

        $this->line(sprintf(
            '  %d product(s), %d categorised, %d with no category: %s',
            Product::query()->count(),
            Product::query()->whereNotNull('category_id')->count(),
            count($uncategorised),
            $uncategorised === [] ? '—' : implode(', ', $uncategorised),
        ));
    }

    /**
     * A snapshot of the columns this command promises not to touch.
     *
     * @return array<int, array<string, mixed>>
     */
    private function audit(): array
    {
        return Product::query()
            ->orderBy('id')
            ->get(self::AUDITED_COLUMNS)
            ->keyBy('id')
            ->map(fn (Product $product): array => $product->only(self::AUDITED_COLUMNS))
            ->all();
    }

    /**
     * Prove it: compare every audited column before and after the run.
     *
     * @param  array<int, array<string, mixed>>  $before
     */
    private function auditUntouched(array $before): void
    {
        $drift = [];

        foreach ($this->audit() as $id => $after) {
            $original = $before[$id] ?? null;

            if ($original !== $after) {
                $drift[] = $id;
            }
        }

        $this->newLine();
        $this->line($drift === []
            ? '<info>Audit: id, title, slug, price, compare_at_price, currency, legacy_*, stock and is_active are byte-identical before and after.</info>'
            : '<error>Audit failed: these product ids changed outside category_id: '.implode(', ', $drift).'</error>');
    }
}
