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
    <Container className="py-10">
      <Breadcrumbs items={[{ label: 'ورود' }]} />

      <div className="mt-8">
        <OtpLoginForm next={destination} />
      </div>
    </Container>
  );
}
