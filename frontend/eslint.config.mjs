import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/**
 * Flat ESLint config (ESLint 9).
 *
 * `next lint` was removed in Next 16, so the `lint` script in package.json
 * calls `eslint` directly. `eslint-config-next/core-web-vitals` exports a flat
 * config array in v16, which is spread here; the old `.eslintrc.json` is gone.
 */
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // 3D thumbnails and MinIO assets are served unoptimized in dev; the
      // storefront also renders plain <img> in a few 3D fallbacks on purpose.
      '@next/next/no-img-element': 'off',
    },
  },
];
