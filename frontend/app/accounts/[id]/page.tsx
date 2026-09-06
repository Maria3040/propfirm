'use client';

import { useParams } from 'next/navigation';
import AccountsWorkspace from '@/components/accounts/AccountsWorkspace';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <AccountsWorkspace selectedId={id} />;
}
