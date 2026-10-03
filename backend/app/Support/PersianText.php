<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Persian text normalisation for search.
 *
 * Two Arabic letters and a handful of presentation characters look identical to
 * their Persian counterparts on screen but are different code points, so a
 * customer searching for «كتاب» (Arabic kaf) would never match a product named
 * «کتاب» (Persian kaf) — the classic Iranian e-commerce search bug. Both sides
 * of the comparison (the stored value and the query) go through here.
 *
 * The same normalisation is applied by the storefront before it sends the
 * query, so a term is stable whichever side normalises first.
 */
final class PersianText
{
    /**
     * Codepoint → replacement map for the look-alike pairs.
     *
     *  - ي U+064A ARABIC YEH      → ی U+06CC PERSIAN YEH
     *  - ك U+0643 ARABIC KAF      → ک U+06A9 PERSIAN KEHEH
     *  - ة U+0629 TEH MARBUTA     → ه U+0647 HEH
     *  - أ إ آ U+0623/0625/0622   → ا U+0627 ALEF
     *  - ؤ / ئ                    → و / ی
     *
     * @var array<string, string>
     */
    private const MAP = [
        "\u{064A}" => "\u{06CC}", // ي → ی
        "\u{0649}" => "\u{06CC}", // ى → ی
        "\u{0643}" => "\u{06A9}", // ك → ک
        "\u{0629}" => "\u{0647}", // ة → ه
        "\u{0623}" => "\u{0627}", // أ → ا
        "\u{0625}" => "\u{0627}", // إ → ا
        "\u{0622}" => "\u{0627}", // آ → ا
        "\u{0624}" => "\u{0648}", // ؤ → و
        "\u{0626}" => "\u{06CC}", // ئ → ی
    ];

    /**
     * Characters that carry no searchable meaning in Persian: the ZWNJ used
     * inside compound words (میخواهم), the tatweel, and the diacritics.
     */
    private const STRIPPED = [
        "\u{200C}", // ZWNJ
        "\u{200F}", // RLM
        "\u{200E}", // LRM
        "\u{0640}", // ـ tatweel
        "\u{064B}", "\u{064C}", "\u{064D}", "\u{064E}", "\u{064F}",
        "\u{0650}", "\u{0651}", "\u{0652}", "\u{0653}", "\u{0654}",
        "\u{0655}", "\u{0670}",
    ];

    /**
     * Normalise a term for comparison: unify look-alike letters, drop the
     * invisible/diacritic characters, collapse whitespace and lower-case the
     * Latin part.
     */
    public static function normalize(?string $value): string
    {
        if ($value === null) {
            return '';
        }

        $normalized = str_replace(
            array_keys(self::MAP),
            array_values(self::MAP),
            $value,
        );

        $normalized = str_replace(self::STRIPPED, '', $normalized);

        // Persian keyboards produce Arabic-Indic digits too; folding them onto
        // ASCII keeps «۳» and «3» interchangeable in a search box.
        $normalized = strtr($normalized, [
            "\u{06F0}" => '0', "\u{06F1}" => '1', "\u{06F2}" => '2', "\u{06F3}" => '3',
            "\u{06F4}" => '4', "\u{06F5}" => '5', "\u{06F6}" => '6', "\u{06F7}" => '7',
            "\u{06F8}" => '8', "\u{06F9}" => '9', "\u{0660}" => '0', "\u{0661}" => '1',
            "\u{0662}" => '2', "\u{0663}" => '3', "\u{0664}" => '4', "\u{0665}" => '5',
            "\u{0666}" => '6', "\u{0667}" => '7', "\u{0668}" => '8', "\u{0669}" => '9',
        ]);

        return Str::lower(trim(preg_replace('/\s+/u', ' ', $normalized) ?? ''));
    }
}