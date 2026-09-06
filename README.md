# PropFirm — FundingPips-style evaluation platform

Modular monolith with **DDD**: NestJS + TypeORM + Postgres backend, Next.js + React REST frontend.

| Doc | Purpose |
|-----|---------|
| [docs/USER-STORIES.md](docs/USER-STORIES.md) | Epics & acceptance criteria |
| [docs/BOUNDED-CONTEXTS.md](docs/BOUNDED-CONTEXTS.md) | BC map from stories |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical overview |

## Stack

| Side | Technology |
|------|------------|
| Backend | NestJS · TypeORM · PostgreSQL · in-process event bus |
| Frontend | Next.js · React · REST (`NEXT_PUBLIC_API_BASE`) |
| Infra | Docker Compose (Postgres, Redis, Mailpit) |

## Quick start

```powershell
cd propfirm
docker compose up -d
powershell -ExecutionPolicy Bypass -File .\start-propfirm.ps1
```

| Service | URL |
|---------|-----|
| UI | http://localhost:3100 |
| API | http://localhost:6080 |
| Mailpit | http://localhost:8026 |
| Postgres | localhost:15433 (`propfirm` / `propfirm_dev`) |
| SMTP | localhost:2525 |

**Demo logins**

| Role | Email | Password |
|------|-------|----------|
| Trader | `trader@propfirm.local` | `Trader1!` |
| Admin | `admin@propfirm.local` | `Admin1!` |

## Happy path

Register/login → browse catalog → checkout → confirm mock pay → simulate trades → pass or breach → (funded) request payout → admin approve.
