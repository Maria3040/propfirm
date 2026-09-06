# PropFirm — Python modular monolith (this branch)

**Branch:** `feat/backend-python-fastapi-sqlalchemy-postgres-redis_frontend-nextjs-redux`

Runnable **DDD + Clean Architecture** modular monolith: FastAPI delivery, pure domain per bounded context, SQLAlchemy persistence, Redis in the architecture (infrastructure) layer, Next.js + Redux UI.

---

## Stack

| Layer | Choice |
|-------|--------|
| API | **FastAPI** + Uvicorn · OpenAPI `/docs` |
| ORM | **SQLAlchemy 2.0** (mapped columns) · **psycopg3** |
| DB | **PostgreSQL 16** · schema-per-BC |
| Cache / control plane | **Redis 7** (architecture adapters only) |
| Auth | httpOnly cookie JWT (`propfirm_access`) · bcrypt · HS256 |
| Mail | SMTP → **Mailpit** |
| Frontend | **Next.js** App Router · **Redux Toolkit** · same-origin `/api` rewrite |
| Tests | **pytest** unit + integration · **Playwright** e2e |

Ports: UI `:3100` · API `:6080` · Postgres `:15433` · Redis `:6380` · Mailpit UI `:8026` / SMTP `:2525`

---

## Did we use DDD?

**Yes — intentionally, as a modular monolith:**

| DDD idea | How it shows up |
|----------|-----------------|
| Bounded contexts | Packages under `app/modules/*` + Postgres schemas (`users`, `catalog`, `commerce`, `challenges`, `trading`, `risk`, `payouts`, `notifications`, `audithub`, `competitions`) |
| Ubiquitous language | Challenge, Funded, DailyLoss, MaxDrawdown, profit share, payout |
| Pure domain | `modules/*/domain/*` — **no** FastAPI / Redis / SQLAlchemy imports |
| Application services | Orchestration use-cases (e.g. `modules/admin/application/admin_service.py`, `app/services.py` for trading flows) |
| Infrastructure / architecture | `app/architecture/` — DB engine, Redis cache, rate-limit, JWT denylist, SMTP, in-process bus |
| Delivery | `app/api/` — thin HTTP adapters (`routes.py`, `admin_routes.py`, `deps.py`) |
| Anti-corruption | CamelCase JSON DTOs at the edge; snake_case models inside |

### Clean Architecture dependency rule

```
Delivery (api) ──► Application ──► Domain
                       │
                       ▼
              Architecture / Persistence adapters
```

Domain never depends on Redis, HTTP, or ORM. Adapters implement side effects.

---

## Folder map

```
backend-python/
  app/
    api/                 # Delivery (HTTP)
    architecture/        # Infra: Redis, mail, bus, security, db session
    modules/
      admin/application/ # Admin use-cases
      catalog/           # Seed catalog data
      challenges/domain/ # Phase progression
      commerce/domain/   # Pricing + coupons
      payouts/domain/    # Profit-share math
      risk/domain/       # Breach / target evaluation
    persistence/         # SQLAlchemy entities (schema-per-BC)
    shared_kernel/       # DomainError
    services.py          # Cross-BC composition (order paid, simulate trade)
    seed.py / main.py / config.py
  tests/
    unit/                # Pure domain + templates + edge cases
    integration/         # HTTP + Postgres (+ Redis optional)
frontend/                # Next.js UI (trader + admin panel)
```

---

## Redis (architecture layer only)

| Concern | Key | Role |
|---------|-----|------|
| Catalog cache | `propfirm:catalog:products:…` | Hot reads |
| Login rate limit | `propfirm:ratelimit:login:{ip}` | Brute-force blunt |
| JWT denylist | `propfirm:denylist:{sha256}` | Logout invalidation |
| Competitions joined | `propfirm:comps:joined:{traderId}` | Read-through |

Graceful degrade if Redis is down (demo). Production should treat Redis as required for auth hardening.

---

## Admin capabilities

Admin role: `admin@propfirm.local` / `Admin1!`

| Area | API | UI (`/admin`) |
|------|-----|----------------|
| Overview counts | `GET /api/admin/overview` (**server-side aggregates**) | KPI cards (deep-link into filtered tabs) |
| Traders | `GET /api/admin/traders?page&pageSize&q&sortBy&sortDir&role` | Paginated table |
| Challenges | `GET /api/admin/challenges?…&status` · `POST …/close` | Paginated list + force-close |
| Payouts | `GET /api/admin/payouts?…` · approve/reject · `POST …/comment` | Queue + Comment→email trader |
| Catalog | `GET/PATCH /api/admin/catalog/products?…` | Paginated SKUs |
| Audit | `GET /api/admin/audit?…` | Paginated timeline |
| Notifications | `GET /api/admin/notifications?…` | Paginated outbox |

List endpoints return `{ items, page, pageSize, total, totalPages, sortBy, sortDir, q, filters }`.

Trader JWT calling admin routes → **403**.

---

## Happy path (trader)

`Login → Catalog (+ Redis) → Coupon → Order → Confirm → Credentials email → Simulate → Risk → Funded → Profit-share payout → Admin approve → Mail`

---

## Run

```powershell
cd propfirm
docker compose up -d
powershell -ExecutionPolicy Bypass -File .\start-propfirm.ps1
```

```powershell
cd backend-python
python -m pytest -q                 # unit (+ some redis)
python -m pytest -q -m integration  # needs Postgres
cd ../frontend
npm run test:e2e                    # Playwright (API + UI up)
```

Verify: `.\verify-propfirm.ps1`

---

## Design notes / honesty

- Cross-BC events use an **in-process bus** (not Redis Streams) for local demo simplicity.
- Persistence models are still centralized in `app/persistence` (pragmatic modular monolith); domain stays free of ORM.
- Frontend is not a DDD layer — it consumes the HTTP ACL.
