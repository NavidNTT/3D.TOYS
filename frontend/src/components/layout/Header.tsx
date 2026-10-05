import { getServerSessionUser } from '@/src/lib/auth/session';
import HeaderBar from './HeaderBar';

/**
 * Site header (server component).
 *
 * Auth state is resolved on the server from the httpOnly session cookie, so the
 * first HTML the browser receives already knows whether the visitor is signed
 * in — no hydration flash, and the token itself never reaches the client. The
 * interactive parts (cart count, search, logout) live in the client
 * {@link HeaderBar}, which receives the user as a plain prop.
 */
export default async function Header() {
  const user = await getServerSessionUser();

  return <HeaderBar user={user} />;
}
