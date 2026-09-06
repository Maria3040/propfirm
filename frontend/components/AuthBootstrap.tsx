'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { api } from '@/lib/api';
import { clearUser, setUser, type AuthUser } from '@/store/authSlice';
import type { AppDispatch } from '@/store';

type MeResponse = {
  id: string;
  email: string;
  displayName: string;
  role: string;
};

/** Composition-root bootstrap: hydrate Redux from httpOnly session cookie via /api/users/me. */
export function AuthBootstrap() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    let cancelled = false;
    api<MeResponse>('/api/users/me')
      .then((me) => {
        if (cancelled) return;
        const user: AuthUser = {
          userId: me.id,
          email: me.email,
          displayName: me.displayName,
          role: me.role,
        };
        dispatch(setUser(user));
      })
      .catch(() => {
        if (!cancelled) dispatch(clearUser());
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
}
