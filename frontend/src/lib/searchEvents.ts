/**
 * Search UI wiring.
 *
 * The header (a client component, rendered on every page) must be able to open
 * the command-palette search without either component importing the other. A
 * window CustomEvent keeps the coupling to one string constant: the header
 * dispatches it, the palette (mounted once in the layout) listens for it, and
 * the "/" keyboard shortcut triggers the same path.
 */
export const SEARCH_OPEN_EVENT = 'toys:open-search';
