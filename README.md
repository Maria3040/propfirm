# PropFirm — FundingPips-style evaluation platform

Modular monolith with **DDD**. Active Go track: **Go + pgx + Postgres** backend (`backend-go/`), Next.js + React frontend. NestJS reference remains in `backend/`.

**Branches:** `master` = Nest REST + localStorage JWT · GraphQL Apollo · Redux httpOnly Nest · **Go modular monolith** = `feat/backend-golang-modular-monolith_frontend-nextjs-redux`.

| Doc | Purpose |
|-----|---------|
| [docs/USER-STORIES.md](docs/USER-STORIES.md) | Epics & acceptance criteria |
| [docs/BOUNDED-CONTEXTS.md](docs/BOUNDED-CONTEXTS.md) | BC map from stories |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical overview |
| [docs/diagrams/](docs/diagrams/) | **UML (PlantUML)** + **BPMN** for [bpmn.io](https://demo.bpmn.io) |

## Stack

| Side | Technology |
|------|------------|
| Backend | **Go modular monolith** (`backend-go/`) · pgx · PostgreSQL · in-process event bus · Nest reference in `backend/` |
| Frontend | Next.js App Router · React · Redux · REST via same-origin rewrites — **no ORM** |
| Infra | Docker Compose (Postgres, Redis, Mailpit) |
| Tests | Go unit + integration · Frontend Vitest + Playwright |

## Quick start

```powershell
cd propfirm
docker compose up -d
powershell -ExecutionPolicy Bypass -File .\start-propfirm.ps1
```

| Service | URL |
|---------|-----|
| UI | http://localhost:3100 (use **localhost**, not `127.0.0.1`, unless CORS includes both) |
| API | http://localhost:6080 |
| Mailpit | http://localhost:8026 |
| Postgres | localhost:15433 (`propfirm` / `propfirm_dev`) |
| SMTP | localhost:2525 |

**Demo logins:** `trader@propfirm.local` / `Trader1!` · `admin@propfirm.local` / `Admin1!`

## Diagrams (UML + BPMN)

| Artifact | How to view |
|----------|-------------|
| [`docs/diagrams/propfirm-processes.bpmn`](docs/diagrams/propfirm-processes.bpmn) | Open at **https://demo.bpmn.io** → *Open file* (purchase collaboration + login/IP history) |
| [`architecture-containers.puml`](docs/diagrams/architecture-containers.puml) | PlantUML — containers / deployment |
| [`domain-classes.puml`](docs/diagrams/domain-classes.puml) | PlantUML — BC class sketch |
| [`sequence-login-history.puml`](docs/diagrams/sequence-login-history.puml) | PlantUML — login + history sequence |

## Frontend ORM — when would you use one?

**This project does not use a frontend ORM** (no Prisma / Drizzle / Kysely in Next.js). The UI talks to Nest over HTTP; **TypeORM stays on the API**.

| Situation | Use ORM in frontend? | What we do instead |
|-----------|----------------------|--------------------|
| Authenticated trader data (accounts, payouts, login history) | **No** — belongs behind the API | REST + JWT → Nest + TypeORM |
| Shared DB from browser | **Never** — leaks credentials / bypasses domain rules | API only |
| Marketing site with CMS tables in the same Next process | Optional (e.g. Prisma in **Route Handlers / Server Actions** only) | Not applicable here |
| Offline-first / local cache | Not an ORM — IndexedDB / localStorage | Basket + settings prefs in `localStorage` |
| Admin scripts / one-off Next server jobs | Possible server-side Prisma | Prefer Nest modules |

**Rule of thumb:** if the data has business rules (challenges, risk, payouts), keep the ORM on the **backend**. Use a frontend ORM only for **server-side** Next code that owns a *separate* read model — never from Client Components.

## Rendering strategy (SSR / SSG / ISR / CSR)

### How we decided

Next.js App Router defaults:

1. **Server Component** (no `'use client'`) → can be static (SSG) or dynamic SSR depending on APIs used.
2. **`'use client'`** → Client Component: still **SSR’d once for HTML shell**, then **hydrated**; **data loading is CSR** (`useEffect`, `localStorage`, browser `fetch`).
3. **SSG** = build-time HTML with no per-request server work (`generateStaticParams` / static data, no cookies).
4. **ISR** = SSG + `revalidate` / `fetch(..., { next: { revalidate } })`.
5. **Full CSR SPA-style** = client-only data; we never used `output: 'export'` for the whole app.

**Decision drivers for PropFirm**

| Driver | Choice |
|--------|--------|
| Heavy interactivity (configurator, basket, drawers, theme) | Client Components |
| Auth via `localStorage` JWT (not cookies) | Data must load on client → **CSR data** |
| Personalized / private pages | Not cacheable as SSG → avoid ISR for trader data |
| Demo catalog & calendar use client filters / API | CSR or future SSR with `cache: 'no-store'` |
| Almost no public SEO-critical static content yet | SSG/ISR deferred |

Root `app/layout.tsx` is a **Server Component**, but it renders `AppChrome` (`'use client'`), so the chrome and most pages hydrate on the client.

### Route catalog

| Route | Mode | Why |
|-------|------|-----|
| `/` (catalog) | **CSR** (`'use client'`) | Interactive configurator, FX toggle, basket |
| `/login`, `/register`, `/forgot-password` | **CSR** | Forms, theme, remember-me `localStorage` |
| `/accounts`, `/accounts/[id]` | **CSR** | JWT session + live API |
| `/dashboard`, `/challenges/[id]` | **CSR** | Auth-gated API |
| `/checkout/[productId]`, `/pay/confirmo` | **CSR** | Basket + payment UI |
| `/payouts`, `/payouts/request` | **CSR** | Wallet API |
| `/competitions`, `/competitions/[id]`, `/leaderboards` | **CSR** | Client filters / timers |
| `/certificates`, `/economic-calendar`, `/affiliate` | **CSR** | Client state / demo datasets |
| `/tools/risk-calculator` | **CSR** | Calculator state |
| `/trade-copier` | **SSR shell** (server page → stub) | Static stub; no data fetch |
| `/tools` | **SSR** (Server Component) | Static links hub |
| `/settings` | **SSR redirect** | `redirect('/settings/profile')` |
| `/settings/profile`, `/security`, … | **CSR** (most) | Forms + login history API |
| `/settings/bank-accounts`, `credit-cards`, `early-access`, `payment-history` | **SSR** (no `'use client'`) | Static empty states |
| `/admin` | **CSR** | Admin JWT + audit API |

**Not used today**

| Mode | Status | Future candidates |
|------|--------|-------------------|
| **SSG** | Unused | Public marketing landing, static `/tools` copy |
| **ISR** | Unused | Economic calendar / leaderboards if moved to server `fetch` + `revalidate: 60` |
| **SSR (dynamic, server fetch)** | Unused for trader data | Prefer when JWT moves to httpOnly cookies |

### Practical summary

```
Most trader UX  →  Client Components + CSR data fetching
A few static settings/tools hubs  →  Server Components (SSR/static)
SSG / ISR  →  intentionally not used yet (auth + interactivity first)
ORM  →  backend TypeORM only
```

## Tests

```powershell
cd backend; npm test
cd frontend; npm test
cd frontend; npx playwright install chromium; npm run test:e2e
```

## Happy path

Register/login → browse catalog → checkout → confirm mock pay → simulate trades → pass or breach → (funded) request payout → admin approve. Open Mailpit for emails; Security settings for login history (VPN/VPS/residential).
