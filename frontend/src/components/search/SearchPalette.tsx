'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Price from '@/src/components/ui/Price';
import { normalizeSearchTerm } from '@/src/lib/persian';
import { SEARCH_OPEN_EVENT } from '@/src/lib/searchEvents';
import type { Product } from '@/src/types/product';

/**
 * Command-palette search.
 *
 * Opened by the header's جستجو control (a window event, so neither component
 * imports the other) or the "/" key, and closed by Escape, a backdrop click or
 * navigation. Results stream from `/api/search`, which normalises the term the
 * same way the backend does — so «كتاب» typed with an Arabic kaf matches a
 * product written with a Persian keheh.
 */

interface SearchResponse {
  success: boolean;
  message: string;
  data: { items: Product[] } | null;
}

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 8;

export default function SearchPalette() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);

  // Open on the header event; "/" anywhere outside a text field.
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName.toLowerCase();

        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target?.isContentEditable
        ) {
          return;
        }

        event.preventDefault();
        onOpen();
        return;
      }

      if (event.key === 'Escape') close();
    };

    window.addEventListener(SEARCH_OPEN_EVENT, onOpen);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener(SEARCH_OPEN_EVENT, onOpen);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  // Debounced, cancellable lookup.
  useEffect(() => {
    abortRef.current?.abort();

    const query = normalizeSearchTerm(term);

    if (!open || query === '') {
      setResults([]);
      setSearching(false);
      setActive(-1);
      return undefined;
    }

    setSearching(true);

    const timer = window.setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=${RESULT_LIMIT}`,
          { signal: controller.signal },
        );

        const payload = (await response.json()) as SearchResponse;

        if (!response.ok || !payload.success || payload.data === null) {
          setResults([]);
        } else {
          setResults(payload.data.items);
          setActive(payload.data.items.length > 0 ? 0 : -1);
        }
      } catch {
        // An aborted request is expected; anything else just leaves no results.
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (abortRef.current === controller) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [term, open]);

  const go = useCallback(
    (path: string) => {
      close();
      setTerm('');
      setResults([]);
      router.push(path);
    },
    [close, router],
  );

  const submit = () => {
    const query = normalizeSearchTerm(term);

    if (query === '') return;

    go(`/search?q=${encodeURIComponent(query)}`);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) =>
        results.length === 0 ? -1 : (index + 1) % results.length,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) =>
        results.length === 0
          ? -1
          : (index - 1 + results.length) % results.length,
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const picked = results[active];

      if (picked) go(`/products/${picked.slug}`);
      else submit();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="جستجوی محصولات"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 sm:pt-28"
    >
      <button
        type="button"
        aria-label="بستن جستجو"
        onClick={close}
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-surface shadow-pop">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="palette-results"
          aria-autocomplete="list"
          aria-activedescendant={
            active >= 0 ? `palette-option-${active}` : undefined
          }
          aria-label="عبارت جستجو"
          autoComplete="off"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="جستجوی اسباب‌بازی…"
          className="w-full border-b border-ink/10 px-5 py-4 text-base text-ink outline-none placeholder:text-ink/40"
        />

        <div
          id="palette-results"
          role="listbox"
          aria-label="نتایج جستجو"
          className="max-h-[55vh] overflow-y-auto"
        >
          {searching && results.length === 0 && (
            <p className="px-5 py-6 text-sm text-ink/50">در حال جستجو…</p>
          )}

          {!searching && term.trim() !== '' && results.length === 0 && (
            <p className="px-5 py-6 text-sm text-ink/50">
              محصولی با این عبارت پیدا نشد.
            </p>
          )}

          <ul>
            {results.map((product, index) => (
              <li
                key={product.id}
                id={`palette-option-${index}`}
                role="option"
                aria-selected={index === active}
              >
                <button
                  type="button"
                  onClick={() => go(`/products/${product.slug}`)}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-start transition ${
                    index === active ? 'bg-cream-100' : ''
                  }`}
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-cream-100">
                    {product.media_3d?.thumbnail_url ? (
                      <Image
                        src={product.media_3d.thumbnail_url}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-lg">
                        🧸
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block font-bold text-ink">
                      {product.title}
                    </span>
                    {product.category && (
                      <span className="text-xs text-ink/50">
                        {product.category.name}
                      </span>
                    )}
                  </span>

                  <Price value={product.price} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2 text-xs text-ink/50">
          <span>Enter برای مشاهده همه نتایج</span>
          <span>Esc برای بستن</span>
        </div>
      </div>
    </div>
  );
}

