'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ChallengeDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/accounts/${id}`);
  }, [id, router]);

  return <p className="meta">Opening account…</p>;
}
