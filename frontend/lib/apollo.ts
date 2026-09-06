'use client';

import { ApolloClient, HttpLink, InMemoryCache, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getToken } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:6080';

const httpLink = new HttpLink({
  uri: `${API}/graphql`,
});

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? getToken() : null;
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

let client: ApolloClient<unknown> | null = null;

export function getApolloClient() {
  if (!client) {
    client = new ApolloClient({
      link: from([authLink, httpLink]),
      cache: new InMemoryCache(),
      defaultOptions: {
        watchQuery: { fetchPolicy: 'network-only' },
        query: { fetchPolicy: 'network-only' },
      },
    });
  }
  return client;
}
