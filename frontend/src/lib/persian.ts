/**
 * Persian text helpers for the storefront.
 *
 * Mirrors `App\Support\PersianText::normalize()` on the backend: the same
 * look-alike Arabic letters are unified on both sides so a query is stable
 * whichever side normalises first. The backend still normalises server-side —
 * this only keeps what the user sees and what is sent in sync.
 */

const CHAR_MAP: Record<string, string> = {
  'ي': 'ی', // U+064A → U+06CC
  'ى': 'ی', // U+0649 → U+06CC
  'ك': 'ک', // U+0643 → U+06A9
  'ة': 'ه', // U+0629 → U+0647
  'أ': 'ا', // U+0623 → U+0627
  'إ': 'ا', // U+0625 → U+0627
  'آ': 'ا', // U+0622 → U+0627
  'ؤ': 'و', // U+0624 → U+0648
  'ئ': 'ی', // U+0626 → U+06CC
};

/** ZWNJ, direction marks, tatweel and Arabic diacritics: no search meaning. */
const STRIPPED_RE =
  /[\u200C\u200E\u200F\u0640\u064B-\u0655\u0670]/g;

/** Persian + Arabic-Indic digits → ASCII, so «۳» and «3» match. */
const DIGIT_MAP: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

function mapChars(value: string, map: Record<string, string>): string {
  let out = value;

  for (const [from, to] of Object.entries(map)) {
    out = out.split(from).join(to);
  }

  return out;
}

/** Fold Persian/Arabic-Indic digits onto ASCII. */
export function toAsciiDigits(value: string): string {
  return mapChars(value, DIGIT_MAP);
}

/**
 * Normalise a search term exactly like the backend: unify look-alike letters,
 * drop invisible/diacritic characters, fold digits, collapse whitespace and
 * lower-case the Latin part.
 */
export function normalizeSearchTerm(value: string): string {
  const unified = mapChars(value, CHAR_MAP);
  const stripped = unified.replace(STRIPPED_RE, '');
  const folded = toAsciiDigits(stripped);

  return folded.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalise a phone number for the OTP / checkout forms: ASCII digits only,
 * no spaces or dashes, and `+98`/`0098`/`98` international prefixes folded
 * back to the leading `0` the API validates (`^09[0-9]{9}$`).
 */
export function normalizePhone(value: string): string {
  let digits = toAsciiDigits(value).replace(/[^\d+]/g, '');

  if (digits.startsWith('+98')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('0098')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('98') && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }

  return digits;
}

/** Client-side mirror of the API's Iranian mobile rule. */
export function isValidIranianPhone(value: string): boolean {
  return /^09[0-9]{9}$/.test(value);
}

/** Postal codes are exactly 10 ASCII digits (see CheckoutRequest). */
export function normalizePostalCode(value: string): string {
  return toAsciiDigits(value).replace(/\D/g, '').slice(0, 10);
}
