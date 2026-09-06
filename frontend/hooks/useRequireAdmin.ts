'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { loginRedirectUrl } from './loginRedirect';

/** Require authenticated Admin role; redirect traders to dashboard. */
export function useRequireAdmin(nextPath = '/admin'): {
  ready: boolean;
  isAdmin: boolean;
} {
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const ready = useSelector((s: RootState) => s.auth.ready);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(loginRedirectUrl('/admin', nextPath));
      return;
    }
    if (user.role !== 'Admin') {
      router.replace('/dashboard');
    }
  }, [ready, user, router, nextPath]);

  return {
    ready,
    isAdmin: ready && !!user && user.role === 'Admin',
  };
}
