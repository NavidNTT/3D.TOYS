<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductMedia3D;
use App\Support\Currency;
use App\Support\MediaStorage;
use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Publish the repository's local 3D fixtures into canonical storage.
 *
 * The ten `.glb` files that ship under `frontend/public/models/` are demo
 * assets, not uploads: they were never written through the admin panel and
 * therefore have no row in `media3d` and no object in object storage. This
 * command makes them canonical — it uploads each file to the S3-compatible disk
 * and maps it to a product with a readable title.
 *
 * Three properties matter more than the mechanics:
 *
 *  - **Idempotent.** Products are matched by their unique `slug` and media rows
 *    by `product_id`, so re-running uploads the same keys and updates the same
 *    rows instead of duplicating either.
 *  - **Verifiable.** Every uploaded object is read back from the bucket and
 *    re-hashed; the run fails if the stored bytes differ from the local source,
 *    so "the upload returned 200" is never mistaken for "the object is intact".
 *  - **Money-safe.** A new product gets no invented price. `price` is NULL with
 *    currency `IRT`, which is exactly the state the storefront renders as an
 *    unavailable price: the row exists, it is visible, and it cannot be bought
 *    until a human approves a toman amount. Nothing here ever reads, converts or
 *    relabels a legacy USD amount.
 *
 * What gets uploaded, and to which product, lives in config/media_ingest.php —
 * data rather than code, and overridable in a test.
 *
 * The Draco optimizer is deliberately bypassed (see `writeMediaRow()`): these
 * fixtures are already optimised and none of them exists on the local ingest
 * disk, so dispatching `Optimize3DModelJob` for them could only fail.
 */
class Ingest3DModelsCommand extends Command
{
    /**
     * Where the fixtures live relative to `backend/`.
     *
     * Used only when neither `--source` nor `media_ingest.source` is set. The
     * Docker layout mounts only `backend/` into the app container, so a run
     * inside `toy-store-laravel.app` has to stage the files somewhere readable
     * (for example `docker cp` into `/tmp`) and pass `--source` explicitly.
     */
    private const DEFAULT_SOURCE = __DIR__.'/../../../frontend/public/models/draco-check';

    /**
     * @var string
     */
    protected $signature = 'toys:ingest-3d
                            {--source= : Directory holding the .glb fixtures (defaults to frontend/public/models/draco-check)}
                            {--disk= : Canonical disk to upload to (defaults to config media.canonical_disk)}
                            {--dry-run : Verify the fixtures and print the plan without uploading or writing}';

    /**
     * @var string
     */
    protected $description = 'Upload the local 3D fixtures to canonical object storage and map them to catalogue products';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $diskName = (string) ($this->option('disk') ?: MediaStorage::canonicalDisk());
        $entries = $this->entries();

        if ($entries === []) {
            $this->error('Nothing to ingest: config/media_ingest.php lists no entries.');

            return self::FAILURE;
        }

        $source = rtrim(str_replace('\\', '/', $this->sourceDirectory()), '/');

        if (! is_dir($source)) {
            $this->error("Source directory not found: {$source}");
            $this->line('Pass --source=<dir>; inside the container the fixtures have to be staged first.');

            return self::FAILURE;
        }

        $unaccounted = $this->unaccountedFixtures($source, $entries);

        if ($unaccounted !== []) {
            $this->error('Refusing to run: these .glb files are not in the manifest and would be silently ignored:');
            foreach ($unaccounted as $file) {
                $this->line("  - {$file}");
            }

            return self::FAILURE;
        }

        $disk = Storage::disk($diskName);

        $this->line(sprintf(
            '<info>%s</info> — source <comment>%s</comment>, disk <comment>%s</comment>',
            $dryRun ? 'Dry run' : 'Ingesting 3D fixtures',
            $source,
            $diskName,
        ));

        $rows = [];

        foreach ($entries as $entry) {
            try {
                $rows[] = $this->ingestEntry($entry, $source, $disk, $dryRun);
            } catch (RuntimeException $e) {
                $this->error($e->getMessage());

                return self::FAILURE;
            }
        }

        $this->newLine();
        $this->table(
            ['Fixture', 'Object key', 'Bytes', 'sha256', 'Product'],
            array_map(static fn (array $row): array => [
                $row['file'],
                $row['key'],
                number_format($row['size']),
                substr($row['sha256'], 0, 12).'…',
                $row['product'],
            ], $rows),
        );

        $this->newLine();
        $this->line(sprintf(
            '<info>%d product(s) mapped from %d fixture file(s); every stored object re-hashed and matched.</info>',
            count($rows),
            $this->fixtureCount($entries),
        ));
        $this->line('The table lists each product\'s primary asset; optimized renditions and byte-identical duplicates are noted above.');

        if ($dryRun) {
            $this->line('<comment>Dry run: nothing was uploaded and no database row was written.</comment>');
        }

        return self::SUCCESS;
    }

    /**
     * The manifest, i.e. the fixture → product map the run follows.
     *
     * @return list<array{slug: string, title: string, sku: string, description: string, sources: array<string, string>, optimized?: array<string, string>}>
     */
    private function entries(): array
    {
        /** @var array<int, array{slug: string, title: string, sku: string, description: string, sources: array<string, string>, optimized?: array<string, string>}> $entries */
        $entries = (array) config('media_ingest.entries', []);

        return array_values($entries);
    }

    /**
     * Resolve the directory the fixtures are read from.
     */
    private function sourceDirectory(): string
    {
        $configured = (string) ($this->option('source') ?: config('media_ingest.source') ?: self::DEFAULT_SOURCE);

        return $configured;
    }

    /**
     * Upload one manifest entry and map it to its product.
     *
     * @param  array{slug: string, title: string, sku: string, description: string, sources: array<string, string>, optimized?: array<string, string>}  $entry
     * @return array{file: string, key: string, size: int, sha256: string, product: string}
     */
    private function ingestEntry(array $entry, string $source, Filesystem $disk, bool $dryRun): array
    {
        $primary = null;
        $duplicateFile = null;
        $optimized = null;

        foreach ($entry['sources'] as $file => $key) {
            $result = $this->upload($source.'/'.$file, $key, $disk, $dryRun);
            $result['product'] = $entry['title'];

            if ($primary === null) {
                $primary = $result;

                continue;
            }

            // A second source for the same asset is only acceptable when it is
            // the same bytes; anything else would quietly publish a different
            // model under the entry's title.
            if ($result['sha256'] !== $primary['sha256']) {
                throw new RuntimeException(sprintf(
                    '%s and %s are listed as the same asset but differ (%s vs %s). '
                    .'Split them into separate manifest entries.',
                    $primary['file'],
                    $result['file'],
                    substr($primary['sha256'], 0, 12),
                    substr($result['sha256'], 0, 12),
                ));
            }

            $duplicateFile = $result['file'];
        }

        if ($primary === null) {
            throw new RuntimeException("Manifest entry [{$entry['slug']}] lists no source file.");
        }

        foreach ($entry['optimized'] ?? [] as $file => $key) {
            $result = $this->upload($source.'/'.$file, $key, $disk, $dryRun);
            $result['product'] = $entry['title'].' (optimized)';
            $optimized = $result;
        }

        // The viewer streams the optimized file when there is one, so the
        // recorded size is the size of what is actually downloaded.
        $servedSize = $optimized['size'] ?? $primary['size'];
        $servedKey = $optimized['key'] ?? $primary['key'];

        if (! $dryRun) {
            $product = $this->writeProductRow($entry);
            $this->writeMediaRow($product, $primary['key'], $servedKey, $servedSize);
        }

        // Only the primary and the optimized rendition are worth a table row
        // each; a byte-identical duplicate is reported inline instead.
        if ($duplicateFile !== null) {
            $this->line(sprintf(
                '  <comment>note</comment> %s is a byte-identical duplicate of %s; both uploaded, product maps to the first.',
                $duplicateFile,
                $primary['file'],
            ));
        }

        if ($optimized !== null) {
            $this->line(sprintf(
                '  <comment>note</comment> %s recorded as the optimized asset for %s.',
                $optimized['key'],
                $entry['title'],
            ));
        }

        return $primary;
    }

    /**
     * Copy one fixture to the canonical disk and prove the stored object.
     *
     * @return array{file: string, key: string, size: int, sha256: string, product: string}
     */
    private function upload(string $absolute, string $key, Filesystem $disk, bool $dryRun): array
    {
        if (! is_file($absolute)) {
            throw new RuntimeException("Fixture missing: {$absolute}");
        }

        $size = (int) filesize($absolute);
        $this->assertGlb($absolute, $size);
        $sha256 = (string) hash_file('sha256', $absolute);

        if ($dryRun) {
            return ['file' => basename($absolute), 'key' => $key, 'size' => $size, 'sha256' => $sha256, 'product' => ''];
        }

        $stream = fopen($absolute, 'rb');

        if ($stream === false) {
            throw new RuntimeException("Cannot open fixture for reading: {$absolute}");
        }

        try {
            $disk->writeStream($key, $stream);
        } finally {
            fclose($stream);
        }

        // Read the object back through the disk (not the local path) and hash
        // what actually landed in the bucket: a truncated or re-encoded upload
        // has to be caught here, while the command can still fail.
        $read = $disk->readStream($key);

        if (! is_resource($read)) {
            throw new RuntimeException("Uploaded object cannot be read back from the disk: {$key}");
        }

        try {
            $context = hash_init('sha256');
            hash_update_stream($context, $read);
            $storedHash = hash_final($context);
        } finally {
            fclose($read);
        }

        if (! hash_equals($sha256, $storedHash)) {
            throw new RuntimeException(sprintf(
                'Integrity check failed for %s: local %s, stored %s.',
                $key,
                substr($sha256, 0, 16),
                substr($storedHash, 0, 16),
            ));
        }

        return ['file' => basename($absolute), 'key' => $key, 'size' => $size, 'sha256' => $sha256, 'product' => ''];
    }

    /**
     * Create or update the product a manifest entry maps to.
     *
     * `price` stays NULL and the currency stays `IRT`: the row is published (so
     * its viewer is reachable) but carries no chargeable toman amount, which is
     * what makes `purchasable` false on the API. No legacy amount is read here,
     * and no rate is applied.
     *
     * @param  array{slug: string, title: string, sku: string, description: string}  $entry
     */
    private function writeProductRow(array $entry): Product
    {
        return Product::query()->updateOrCreate(
            ['slug' => $entry['slug']],
            [
                // No category: the existing taxonomy (bath toys, blocks,
                // figures, RC) does not describe a model car or a blaster, and
                // inventing categories is a merchandising decision, not an
                // ingestion step.
                'category_id' => null,
                'title' => $entry['title'],
                'sku' => $entry['sku'],
                'description' => $entry['description'],
                'price' => null,
                'compare_at_price' => null,
                'currency' => Currency::IRT,
                'stock' => 0,
                'is_active' => true,
                'attributes' => ['Format' => 'GLB'],
            ],
        );
    }

    /**
     * Attach (or refresh) the product's 3D media row.
     *
     * Written with `withoutEvents()` on purpose. `ProductMedia3DObserver`
     * dispatches `Optimize3DModelJob` whenever a non-URL `original_file_url` is
     * stored, and that job reads the file from the local ingest disk. These
     * fixtures live in the frontend tree and are already optimised, so the job
     * could only throw, retry, and land in `failed_jobs` — the same reasoning
     * the catalogue seeder documents for its fixture rows. Storing an object key
     * is therefore a quiet write; only real uploads go through Draco.
     */
    private function writeMediaRow(Product $product, string $originalKey, string $servedKey, int $servedSize): void
    {
        $optimizedKey = $servedKey === $originalKey ? null : $servedKey;

        ProductMedia3D::withoutEvents(function () use ($product, $originalKey, $optimizedKey, $servedSize): void {
            ProductMedia3D::query()->updateOrCreate(
                ['product_id' => $product->id],
                [
                    'original_file_url' => $originalKey,
                    'optimized_file_url' => $optimizedKey,
                    'thumbnail_url' => null,
                    'lighting_preset' => 'studio',
                    'camera_settings' => null,
                    'auto_rotate' => true,
                    'rotation_speed' => 1.0,
                    'file_size' => $servedSize,
                ],
            );
        });
    }

    /**
     * How many fixture files the manifest accounts for in total.
     *
     * More than one file can belong to a single product (an optimized
     * rendition, or a byte-identical duplicate), so this is the count that
     * proves the whole tree was ingested — not the number of products.
     *
     * @param  list<array{slug: string, sources: array<string, string>, optimized?: array<string, string>}>  $entries
     */
    private function fixtureCount(array $entries): int
    {
        $count = 0;

        foreach ($entries as $entry) {
            $count += count($entry['sources']) + count($entry['optimized'] ?? []);
        }

        return $count;
    }

    /**
     * `.glb` files in the source directory that no manifest entry claims.
     *
     * A file nobody lists is a file nobody would notice was skipped, so the run
     * stops instead of quietly ingesting a subset of the tree.
     *
     * @param  list<array{slug: string, sources: array<string, string>, optimized?: array<string, string>}>  $entries
     * @return list<string>
     */
    private function unaccountedFixtures(string $source, array $entries): array
    {
        $listed = [];

        foreach ($entries as $entry) {
            foreach ([...array_keys($entry['sources']), ...array_keys($entry['optimized'] ?? [])] as $file) {
                $listed[] = $file;
            }
        }

        $present = array_map(
            static fn (string $path): string => basename($path),
            glob($source.'/*.glb') ?: [],
        );

        return array_values(array_diff($present, $listed));
    }

    /**
     * Reject a file that is not a well-formed binary glTF container.
     *
     * The 12-byte header states magic, version and the total byte length, so a
     * truncated download or an HTML error page saved as `.glb` is caught before
     * it is published as a model the viewer would fail to parse.
     */
    private function assertGlb(string $absolute, int $size): void
    {
        $handle = fopen($absolute, 'rb');

        if ($handle === false) {
            throw new RuntimeException("Cannot open fixture for validation: {$absolute}");
        }

        try {
            $header = fread($handle, 12);
        } finally {
            fclose($handle);
        }

        if (! is_string($header) || strlen($header) < 12) {
            throw new RuntimeException("Not a binary glTF file (too short): {$absolute}");
        }

        /** @var array<int, int> $parts */
        $parts = array_values(unpack('V3', $header));

        if ($parts[0] !== 0x46546C67) {
            throw new RuntimeException("Not a binary glTF file (bad magic): {$absolute}");
        }

        if ($parts[1] !== 2) {
            throw new RuntimeException("Unsupported glTF container version {$parts[1]}: {$absolute}");
        }

        if ($parts[2] !== $size) {
            throw new RuntimeException(sprintf(
                'Truncated glTF container: header declares %d bytes, file is %d.',
                $parts[2],
                $size,
            ));
        }
    }
}
