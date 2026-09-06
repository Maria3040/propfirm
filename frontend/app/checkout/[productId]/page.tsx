'use client';

import { Suspense } from 'react';
import CheckoutInner from './CheckoutInner';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<p className="meta">Loading…</p>}>
      <CheckoutInner />
    </Suspense>
  );
}
