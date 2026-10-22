import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import OtpLoginForm from '@/src/components/auth/OtpLoginForm';
import Breadcrumbs from '@/src/components/ui/Breadcrumbs';
import Container from '@/src/components/ui/Container';
import { getServerSessionUser } from '@/src/lib/auth/session';

/**
 * Login page (`/login`).
 *
 * The session is read on the server from the httpOnly cookie: a visitor who is
 * already signed in is sent straight on to `next`, and everyone else gets the
 * two-step OTP form. The form posts to a route handler, which stores the
 * returned token in the cookie — the page itself never handles it.
 *
 * The hero mirrors the cart/checkout pages so the entry point into the account
 * flow carries the same Playful Premium presentation. The page owns the single
 * `<h1>`; the form below starts at `<h2>`.
 */
export const metadata: Metadata = {
  title: 'ورود | Toy Store',
};

/**
 * Only same-origin paths are honoured as a post-login destination, so a
 * crafted `?next=//evil.example` cannot bounce a fresh session elsewhere.
 */
function safeNext(raw: string | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';

  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  const user = await getServerSessionUser();

  if (user !== null) {
    redirect(destination);
  }

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ label: 'ورود' }]} />

      <section className="relative isolate mt-4 overflow-hidden rounded-[2rem] bg-cream-100 px-5 py-8 sm:rounded-[2.5rem] sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-16 -z-10 h-56 w-56 rounded-full bg-toy-lime/40 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 right-1/4 -z-10 h-52 w-52 rounded-full bg-brand-500/10 blur-3xl"
        />

        <p className="text-[10px] font-black tracking-[0.2em] text-brand-500">
          SIGN IN
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
          ورود به حساب
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-graphite-700">
          با شماره موبایل خود وارد شوید؛ کد تأیید را برایتان پیامک می‌کنیم و
          نیازی به رمز عبور نیست.
        </p>
      </section>

      <div className="mt-6">
        <OtpLoginForm next={destination} />
      </div>
    </Container>
  );
}
