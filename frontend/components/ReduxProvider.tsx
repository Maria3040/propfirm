'use client';

import { useRef } from 'react';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import { store } from '@/store';

export function ReduxProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef(store);
  return <Provider store={storeRef.current}>{children}</Provider>;
}
