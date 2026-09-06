'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import type { AuthUser } from '@/store/authSlice';
import { loginRedirectUrl } from './loginRedirect';

export { loginRedirectUrl } from './loginRedirect';

/**
 * Wait for AuthBootstrap (/api/users/me) before deciding.
 * Redirects unauthenticated visitors to login with a return URL.
 */
export function useRequireAuth(nextPath?: string): {
  user: AuthUser | null;
  ready: boolean;
  authenticated: boolean;
} {
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((s: RootState) => s.auth.user);
  const ready = useSelector((s: RootState) => s.auth.ready);

  useEffect(() => {
    if (!ready) return;
    if (user) return;
    router.replace(loginRedirectUrl(pathname || '/', nextPath));
  }, [ready, user, router, pathname, nextPath]);

  return {
    user,
    ready,
    authenticated: ready && !!user,
  };
}
