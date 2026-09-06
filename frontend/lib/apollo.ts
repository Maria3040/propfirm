'use client';

import { ApolloClient, HttpLink, InMemoryCache, from } from '@apollo/client';

const uri =
  typeof window !== 'undefined'
    ? `${process.env.NEXT_PUBLIC_API_BASE || ''}/graphql`
    : 'http://127.0.0.1:6080/graphql';

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
