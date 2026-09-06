'use client';

import { Suspense } from 'react';
import { ConfirmoPayMock } from '@/components/ConfirmoPayMock';

export default function ConfirmoPayPage() {
  return (
    <Suspense fallback={<p className="meta">Loading payment…</p>}>
      <ConfirmoPayMock />
    </Suspense>
  );
}
