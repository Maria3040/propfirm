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
  └── AppChrome
        └── ReduxProvider           # Redux Toolkit store
              └── AuthBootstrap     # GET /api/users/me → auth slice
              └── ApolloAppProvider
                    └── AppShell | Auth | bare main
                          └── {children}
```

| File | Responsibility |
|------|----------------|
| [`app/layout.tsx`](app/layout.tsx) | HTML shell, global CSS, mounts `AppChrome` |
| [`components/AppChrome.tsx`](components/AppChrome.tsx) | Route chrome + providers |
| [`components/ReduxProvider.tsx`](components/ReduxProvider.tsx) | `react-redux` `Provider` |
| [`components/AuthBootstrap.tsx`](components/AuthBootstrap.tsx) | Hydrate session from httpOnly cookie |
| [`components/ApolloAppProvider.tsx`](components/ApolloAppProvider.tsx) | Apollo Client (credentials include) |
| [`components/AppShell.tsx`](components/AppShell.tsx) | Sidebar / basket; reads `auth.user` from Redux |

There is no DI container. Dependencies are **import-wired** modules and React context (Apollo only).

Nested layout example: [`app/settings/layout.tsx`](app/settings/layout.tsx) adds settings nav around settings pages without replacing the root composition root.

---

## How dependencies are wired

### Runtime / env

| Dependency | How it is wired |
|------------|-----------------|
| Nest REST | `lib/api.ts` → `fetch` with `credentials: 'include'` (relative `/api` via Next rewrite) |
| Nest GraphQL | `lib/apollo.ts` → same-origin `/graphql` + cookie credentials |
| JWT | **httpOnly cookie** set by Nest (`propfirm_access`); not readable from JS |
| Redux | `@reduxjs/toolkit` + `react-redux` — profile/UI only |
| Path aliases | `tsconfig` `@/*` → project root (e.g. `@/lib/api`) |
| Next config | `rewrites` proxy `/api/*` and `/graphql` → `API_PROXY_TARGET` (default `http://127.0.0.1:6080`) |

### npm packages

| Package | Role |
|---------|------|
| `next` / `react` / `react-dom` | App Router UI |
| `@reduxjs/toolkit` / `react-redux` | Client state (auth profile, UI) |
| `@apollo/client` + `graphql` | GraphQL client (lab) |
| `vitest` / `jsdom` | Unit tests for `lib/*` |
| `@playwright/test` | Browser smoke |

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

**Redux Toolkit** (`store/`) holds non-secret app state:

| Slice | Responsibility |
|-------|----------------|
| `auth` | Trader profile (`userId`, email, role) after login / `/api/users/me` |
| `ui` | Shell UI flags (e.g. basket open) |

**JWT is not in Redux or `localStorage`.** Nest sets an **httpOnly** cookie (`propfirm_access`). The browser sends it on same-origin requests (`credentials: 'include'` via Next rewrites to `:6080`).

Basket lines remain in `localStorage` (`lib/basket.ts`) — cart is not secret auth state.

Theme (`pf-theme`) stays in `localStorage` via `ThemeToggle`.

**Large lists:** `lib/list-utils.ts` (`useFilteredPagination`) + `components/VirtualizedList.tsx` (`@tanstack/react-virtual`) — used on Competitions (filter → paginate → virtualize). Reuse the same pair for leaderboards / accounts later.

Composition root: `AppChrome` → `ReduxProvider` → `AuthBootstrap` → `ApolloAppProvider` → shell/page.

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

App-owned `use*` hooks are still minimal. Reusable auth helpers stay in `lib/api.ts` + Redux actions.

Library / framework hooks used:

- Redux: `useSelector`, `useDispatch`
- Apollo: `useQuery` (GraphQL lab)
- Next: `useRouter`, `usePathname`, `useParams`, `useSearchParams`

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
