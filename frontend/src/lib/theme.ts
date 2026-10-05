import type { CategoryTheme } from '@/src/types/product';

/**
 * Category theming helpers.
 *
 * `theme_config` arrives from the API at runtime, so Tailwind's compiler cannot
 * see these colours — they are applied as inline styles instead. Everything
 * that paints a category (badges, buttons, glows) goes through here so the
 * palette only has one definition.
 */

export interface ResolvedTheme {
  primary: string;
  glow: string;
  accent: string;
  background: string;
}

/**
 * Storefront defaults for the light warm theme (see globals.css tokens).
 * Used whenever a category ships without theming.
 */
export const FALLBACK_THEME: ResolvedTheme = {
  primary: '#c2410c', // terracotta-700
  glow: '#ea580c', // terracotta-600
  accent: '#b45309', // honey-700
  background: '#faf6ef', // cream-50, matches --color-cream-50
};

export function resolveTheme(theme?: CategoryTheme | null): ResolvedTheme {
  return {
    primary: theme?.primary_color || FALLBACK_THEME.primary,
    glow: theme?.glow_color || FALLBACK_THEME.glow,
    accent: theme?.accent_color || FALLBACK_THEME.accent,
    background: theme?.background_color || FALLBACK_THEME.background,
  };
}

/** Turns a #rgb/#rrggbb colour into rgba() so it can be used for soft glows. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  // Non-hex values (rgb(), hsl(), named colours) are passed through untouched.
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
