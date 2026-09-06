# PropFirm frontend

Next.js 14 (App Router) + React 18 UI for the PropFirm evaluation platform. Talks to the Nest API over **REST** (primary) and, on the GraphQL track, **Apollo Client** → `/graphql`.

| | |
|--|--|
| Dev URL | http://localhost:3100 |
| API base | `NEXT_PUBLIC_API_BASE` (default `http://localhost:6080`) |
| GraphQL lab | http://localhost:3100/graphql-lab |
| Tests | Vitest (`npm test`) · Playwright (`npm run test:e2e`) |

```powershell
cd propfirm/frontend
npm install
npm run dev
```

---

## Architecture

```
app/                  # App Router routes (pages + nested layouts)
  layout.tsx          # Root layout — composition root entry
  */page.tsx          # Route screens (mostly Client Components)
components/           # Shared UI (shell, drawers, accounts, auth chrome)
lib/                  # Wiring: REST client, Apollo, domain helpers, fixtures
e2e/                  # Playwright smoke
```

**Style:** FundingPips-like trader shell — sidebar + mobile nav for authenticated app routes; marketing/catalog outside the shell; auth pages with their own layout.

**Rendering:** Almost every interactive screen is a Client Component (`'use client'`). JWT lives in `localStorage`, so data loads after mount (CSR). Server Components are thin wrappers (root layout metadata, occasional `Suspense` boundaries). No frontend ORM — persistence stays on Nest + TypeORM.

**Layers (mental model):**

| Layer | Role | Examples |
|-------|------|----------|
| Routes | Screens / URL ownership | `app/accounts/page.tsx`, `app/login/page.tsx` |
| Shell | Chrome, nav, basket, session gate | `AppChrome`, `AppShell`, `MobileNavigation` |
| Features | Page-local UI + forms | checkout, settings, risk calculator |
| Adapters | HTTP / GraphQL / storage | `lib/api.ts`, `lib/apollo.ts`, `lib/basket.ts` |
| Pure helpers | Formatters & calc (easy to unit-test) | `lib/risk-calculator.ts`, `lib/accounts-format.ts` |

---

## Composition root

The composition root is the **root layout tree** — where global providers and chrome are assembled once for the whole app:

```
app/layout.tsx
  └── AppChrome                    # route → shell | auth | marketing
        └── ApolloAppProvider      # Apollo Client (GraphQL track)
              └── AppShell | Auth | bare main
                    └── {children}   # current page
```

| File | Responsibility |
|------|----------------|
| [`app/layout.tsx`](app/layout.tsx) | HTML shell, global CSS, mounts `AppChrome` |
| [`components/AppChrome.tsx`](components/AppChrome.tsx) | Chooses shell vs auth vs marketing by pathname; wraps all routes in `ApolloAppProvider` |
| [`components/ApolloAppProvider.tsx`](components/ApolloAppProvider.tsx) | `ApolloProvider` + singleton client from `getApolloClient()` |
| [`components/AppShell.tsx`](components/AppShell.tsx) | Sidebar, basket drawer, session/logout for app routes |

There is no DI container. Dependencies are **import-wired** modules and React context (Apollo only).

Nested layout example: [`app/settings/layout.tsx`](app/settings/layout.tsx) adds settings nav around settings pages without replacing the root composition root.

---

## How dependencies are wired

### Runtime / env

| Dependency | How it is wired |
|------------|-----------------|
| Nest REST | `lib/api.ts` → `fetch(`${API}${path}`)` with optional `Authorization: Bearer` from `localStorage` |
| Nest GraphQL | `lib/apollo.ts` → `HttpLink` to `${API}/graphql` + `setContext` auth link |
| Path aliases | `tsconfig` `@/*` → project root (e.g. `@/lib/api`) |
| Next config | `next.config.js` — `reactStrictMode: true` |

### npm packages

| Package | Role |
|---------|------|
| `next` / `react` / `react-dom` | App Router UI |
| `@apollo/client` + `graphql` | GraphQL client (lab + optional queries) |
| `vitest` / `jsdom` | Unit tests for `lib/*` |
| `@playwright/test` | Browser smoke |

No Redux, Zustand, React Query, or Context-based app store.

### Adapter modules (`lib/`)

| Module | Wires |
|--------|--------|
| `api.ts` | Session CRUD in `localStorage` + typed `api<T>()` REST helper |
| `apollo.ts` | Lazy singleton `ApolloClient` (auth header from `getToken()`) |
| `graphql-ops.ts` | `gql` documents (`me`, `products`, `loginHistory`, `login`, …) |
| `basket.ts` | Basket persistence + `CustomEvent` / `storage` pub-sub |
| `*-data.ts` | Static fixtures / settings helpers for demos |

Pages call adapters directly (e.g. `api('/api/...')`, `useQuery(ME_QUERY)`). No service locator beyond the Apollo singleton.

---

## State management

**No global UI store.** State is layered as:

1. **Local React state** — `useState` / `useReducer`-style patterns via setters on each screen (forms, tabs, drawers, filters).
2. **Browser persistence** — `localStorage` for cross-refresh concerns:
   - Auth: `propfirm_token`, `propfirm_session`
   - Basket: `propfirm_basket` (+ `propfirm-basket-change` event)
   - Theme: `pf-theme` (`ThemeToggle`)
   - Settings prefs / remembered login email where used
3. **Server / remote state** — REST `fetch` in `useEffect` (or event handlers); GraphQL via **Apollo Client cache** on `/graphql-lab` (and any future `useQuery` callers).
4. **URL state** — Next.js `useSearchParams` / `useParams` for checkout product, redirects, etc.

Cross-component sync for the basket uses a small **event bus** (`subscribeBasket`) rather than Context — `AppShell` listens and re-reads storage.

---

## React “lifecycles” (hooks model)

This app uses **function components only**. Class lifecycles (`componentDidMount`, etc.) are not used. Equivalent behavior:

| Classic idea | Hook used here | Typical use |
|--------------|----------------|-------------|
| Mount | `useEffect(..., [])` | Load session, theme, catalog, login history |
| Mount + deps | `useEffect(..., [pathname, …])` | Re-check session / basket on navigation |
| Unmount / cleanup | `useEffect` return | Unsubscribe basket, remove key listeners, unlock `body` scroll |
| Derived state | `useMemo` | Filters, totals, catalog slices, risk calc |
| Stable callbacks | `useCallback` | Basket refresh, account `load()`, mobile menu close |
| DOM / imperative | `useRef` | Checkout focus / scroll root (`BasketCheckout`) |
| A11y ids | `useId` | Mobile nav dialog title |
| Defer for `useSearchParams` | `Suspense` | Login, checkout, Confirmo pay wrappers |

**Strict Mode** (dev) double-invokes effects; session/theme code is written to tolerate that (read storage after mount, avoid SSR `localStorage`).

---

## Custom hooks

**There are no shared `use*` custom hooks** in this codebase today.

Reusable logic lives as **plain modules** instead:

| Prefer | Why |
|--------|-----|
| `getSession` / `api` / `readBasket` | Works outside React; easy Vitest coverage |
| Inline `useEffect` + `useState` in pages | Keeps demo screens self-contained |

Apollo’s library hooks **are** used where GraphQL is demoed:

- `useQuery` — [`app/graphql-lab/page.tsx`](app/graphql-lab/page.tsx)

Next.js navigation hooks (framework, not app-owned):

- `useRouter`, `usePathname`, `useParams`, `useSearchParams`

If you extract a custom hook later, good candidates are `useSession()`, `useBasket()`, or `useApiQuery()` wrapping the existing `lib/*` adapters.

---

## Notable route map

| Area | Path prefix | Data |
|------|-------------|------|
| Marketing / catalog | `/` | Client journey UI |
| Auth | `/login`, `/register`, `/forgot-password` | REST login → `saveSession` |
| Trader shell | `/accounts`, `/payouts`, `/settings`, … | REST + local fixtures |
| Checkout / pay | `/checkout/[productId]`, `/pay/confirmo` | REST + basket storage |
| GraphQL lab | `/graphql-lab` | Apollo → Nest `/graphql` |

---

## Related docs

- Root [`../README.md`](../README.md) — stack, ports, SSR/CSR policy
- [`../AGENTS.md`](../AGENTS.md) — GraphQL branch name and playground URLs
- [`../docs/USER-STORIES.md`](../docs/USER-STORIES.md) — product acceptance criteria
