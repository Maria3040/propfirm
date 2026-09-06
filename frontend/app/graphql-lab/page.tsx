'use client';

import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { LOGIN_HISTORY_QUERY, ME_QUERY, PRODUCTS_QUERY } from '@/lib/graphql-ops';

export default function GraphQLLabPage() {
  const me = useQuery(ME_QUERY);
  const products = useQuery(PRODUCTS_QUERY, { variables: { phaseFamily: 'two_step', variant: 'flex' } });
  const history = useQuery(LOGIN_HISTORY_QUERY);

  return (
    <div className="app-stub" style={{ maxWidth: 720 }}>
      <p className="meta">
        <Link href="/accounts">← Accounts</Link>
      </p>
      <h1>GraphQL lab</h1>
      <p className="lead">
        Branch stack: NestJS GraphQL + TypeORM + Postgres · Next.js Apollo Client. Playground:{' '}
        <a href={(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:6080') + '/graphql'} target="_blank" rel="noreferrer">
          /graphql
        </a>
      </p>

      <section className="card stack" style={{ marginTop: '1.5rem' }}>
        <h2>me</h2>
        {me.loading && <p className="meta">Loading…</p>}
        {me.error && <p className="err">{me.error.message}</p>}
        {me.data && <pre style={{ overflow: 'auto' }}>{JSON.stringify(me.data.me, null, 2)}</pre>}
      </section>

      <section className="card stack" style={{ marginTop: '1.5rem' }}>
        <h2>products (two_step / flex)</h2>
        {products.loading && <p className="meta">Loading…</p>}
        {products.error && <p className="err">{products.error.message}</p>}
        {products.data && (
          <ul>
            {products.data.products.map((p: { id: string; name: string; accountSize: number; price: number }) => (
              <li key={p.id}>
                {p.name} — ${p.accountSize.toLocaleString()} @ ${p.price}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" style={{ marginTop: '1.5rem' }}>
        <h2>loginHistory</h2>
        {history.loading && <p className="meta">Loading…</p>}
        {history.error && <p className="err">{history.error.message}</p>}
        {history.data && (
          <ul>
            {history.data.loginHistory.map(
              (r: { id: string; ip: string; connectionLabel: string; country: string | null }) => (
                <li key={r.id}>
                  {r.ip} · {r.connectionLabel}
                  {r.country ? ` · ${r.country}` : ''}
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
