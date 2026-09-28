import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * Infrastructure status page.
 *
 * This used to be `/`, as the scaffolded landing page (README §3, check 3:
 * "two green UP badges" prove the Next.js → nginx → PHP-FPM → Laravel path
 * works). `/` is now the customer-facing storefront, so the probe moved here
 * unchanged — same URLs, same badges, same purpose.
 */
export const metadata: Metadata = {
  title: 'Stack status | Toy Store',
  description: 'Live UP/DOWN probes for the Laravel API and Next.js runtime.',
  robots: { index: false, follow: false },
};

// Internal address: this component runs *inside* the nextjs.app container,
// so it must talk to the stack over the compose network (service names),
// not through the host's published ports.
const INTERNAL_API = process.env.LARAVEL_INTERNAL_URL ?? 'http://localhost:8080';
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';
const MINIO_URL = process.env.NEXT_PUBLIC_MINIO_URL ?? 'http://localhost:9000';
const MINIO_CONSOLE_URL =
  process.env.NEXT_PUBLIC_MINIO_CONSOLE_URL ?? 'http://localhost:9001';

// Live probes: never serve a cached verdict.
export const dynamic = 'force-dynamic';

type Probe = {
  name: string;
  target: string;
  ok: boolean;
  detail: string;
};

async function probe(name: string, url: string): Promise<Probe> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    return {
      name,
      target: url,
      ok: response.ok,
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      target: url,
      ok: false,
      detail: error instanceof Error ? error.message : 'unreachable',
    };
  }
}

export default async function StatusPage() {
  // Laravel 11 ships a /up health route out of the box.
  const checks = await Promise.all([
    probe('Laravel API', `${INTERNAL_API}/up`),
    probe('Next.js runtime', 'http://127.0.0.1:3000/api/health'),
  ]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sunbeam-400">
          Toy Store
        </p>
        <h1 className="text-4xl font-black leading-tight sm:text-5xl">
          Stack status
          <span className="block text-sky-400">live probes.</span>
        </h1>
        <p className="max-w-2xl text-base text-white/70">
          Next.js 14 App Router on the front, Laravel 12 + MySQL 8 behind nginx,
          Redis for cache and queues, and MinIO for <code>.glb</code> model
          assets.
        </p>
        <p className="text-sm text-white/50">
          Moved here from the landing page — the storefront now lives at{' '}
          <Link className="text-sky-400 hover:underline" href="/">
            /
          </Link>
          .
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {checks.map((check) => (
          <article
            key={check.name}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-block backdrop-blur"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{check.name}</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  check.ok
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-brick-500/20 text-brick-400'
                }`}
              >
                {check.ok ? 'UP' : 'DOWN'}
              </span>
            </div>
            <p className="mt-3 truncate font-mono text-xs text-white/50">{check.target}</p>
            <p className="mt-1 font-mono text-xs text-white/70">{check.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="font-semibold">Wired-up endpoints</h3>
        <ul className="mt-4 space-y-2 font-mono text-sm text-white/70">
          <li>
            Browser → API&nbsp;&nbsp;{' '}
            <a className="text-sky-400 hover:underline" href={PUBLIC_API}>
              {PUBLIC_API}
            </a>
          </li>
          <li>
            Server → API&nbsp;&nbsp;&nbsp;{' '}
            <span className="text-white/50">{INTERNAL_API} (in-network)</span>
          </li>
          <li>
            MinIO assets&nbsp;&nbsp;&nbsp;
            <a
              className="text-sky-400 hover:underline"
              href={MINIO_URL}
              target="_blank"
              rel="noreferrer"
            >
              {MINIO_URL}
            </a>
          </li>
          <li>
            MinIO console&nbsp;&nbsp;
            <a
              className="text-sky-400 hover:underline"
              href={MINIO_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
            >
              {MINIO_CONSOLE_URL}
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
