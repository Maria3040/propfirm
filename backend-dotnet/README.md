# PropFirm — ASP.NET Core modular monolith (DDD)

**Branch:** `feat/backend-dotnet8-aspnetcore-efcore-postgres-modular-monolith_frontend-nextjs-redux`

Runnable **DDD modular monolith** aligned with book **ch07** (`Entity<T>`, repositories/UoW, domain events hook) and the WW Travel Club modular-monolith layout: pure domain per bounded context, application/infrastructure adapters, thin HTTP delivery.

> **Runtime:** targets **.NET 10** (SDK available on this machine). Patterns follow the book’s **.NET 8 / ch07** DDD approach.

---

## Stack

| Layer | Choice |
|-------|--------|
| API | ASP.NET Core Minimal APIs · Swagger `/swagger` |
| ORM | EF Core + **Npgsql** (PostgreSQL) |
| DB | PostgreSQL 16 · schema `propfirm` |
| Auth | httpOnly JWT cookie `propfirm_access` · BCrypt |
| Mail | SMTP → Mailpit |
| Frontend | Next.js + Redux (same UI as other PropFirm tracks) |
| Tests | xUnit **unit** · **integration** (WebApplicationFactory + InMemory) · **e2e journeys** · edge cases |

Ports: UI `:3100` · API `:6080` · Postgres `:15433` · Redis `:6380` · Mailpit `:8026` / SMTP `:2525`

---

## DDD (ch07-style)

| Idea | Where |
|------|--------|
| Entity + domain events collection | `PropFirm.SharedKernel.Entity<TId>` (book ch07) |
| `IUnitOfWork` / `IRepository` | SharedKernel; `PropFirmDbContext` implements UoW |
| Pure domain (no EF/HTTP) | `PropFirm.Domain/Modules/{Risk,Commerce,Payouts,Challenges,Admin}` |
| Use-case orchestration | `PropFirm.Infrastructure/Services/PropFirmAppService` |
| Persistence / mail / JWT | `PropFirm.Infrastructure` |
| Delivery | `PropFirm.Api/Program.cs` (thin endpoints) |

```
Api ──► Infrastructure (adapters + app services) ──► Domain
              │
              └── SharedKernel (Entity, DomainError, UoW)
```

---

## Folder map

```
backend-dotnet/
  PropFirm.slnx
  src/
    PropFirm.SharedKernel/     # ch07 Entity, DomainError, UoW
    PropFirm.Domain/           # BC modules (pure)
    PropFirm.Application/      # layer marker
    PropFirm.Infrastructure/   # EF, seed, mail, JWT, app service
    PropFirm.Api/              # HTTP host :6080
  tests/
    PropFirm.UnitTests/        # domain + edge cases
    PropFirm.IntegrationTests/ # HTTP + InMemory EF
    PropFirm.E2ETests/         # multi-step API journeys
```

---

## Credentials

| User | Password |
|------|----------|
| `trader@propfirm.local` | `Trader1!` |
| `admin@propfirm.local` | `Admin1!` |

---

## Run

```powershell
cd propfirm
docker compose up -d
dotnet run --project backend-dotnet/src/PropFirm.Api
# or: .\start-propfirm.ps1
```

```powershell
cd backend-dotnet
dotnet test
```

---

## API parity (core)

Auth, catalog, coupons, orders/confirm, challenges, simulate trade, payouts wallet/request, admin overview/traders/payouts approve|reject|comment — camelCase JSON for the existing Next.js UI.
