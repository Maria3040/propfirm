'use client';

import { ApolloClient, HttpLink, InMemoryCache, from } from '@apollo/client';

const uri =
  typeof window !== 'undefined'
    ? `${resolveGraphqlBase()}/graphql`
    : 'http://127.0.0.1:6080/graphql';

function resolveGraphqlBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || '').trim();
  if (!raw || /:5080\b/.test(raw)) return '';
  return raw.replace(/\/$/, '');
}
const httpLink = new HttpLink({
  uri,
  credentials: 'include',
});

let client: ApolloClient<unknown> | null = null;

export function getApolloClient() {
  if (!client) {
    client = new ApolloClient({
      link: from([httpLink]),
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: 'network-only' },
        query: { fetchPolicy: 'network-only' },
      },
    });
  }
  return client;
}
