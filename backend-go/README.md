# PropFirm Go API (modular monolith)

Go rewrite of the NestJS PropFirm backend. Same REST contract + httpOnly JWT cookie so the existing Next.js UI works unchanged.

## Stack

- **chi** HTTP router
- **pgx** PostgreSQL
- SQL migrations (`migrations/001_init.sql`) — schema-per-bounded-context
- In-process event bus
- bcrypt + HS256 JWT cookie `propfirm_access`

## Layout

```
cmd/api/                 entrypoint
internal/platform/       config, db, jwt cookie, bus, mail, http helpers
internal/sharedkernel/   domain errors
internal/modules/*/domain  pure domain (risk, pricing, challenge, trading, payouts)
internal/modules/catalog/seed
internal/app/            composition root + HTTP adapters + orchestration
migrations/
tests/integration/       tagged integration tests
```

## Run

```powershell
$env:DATABASE_URL = "postgresql://propfirm:propfirm_dev@127.0.0.1:15433/propfirm"
$env:HTTP_PORT = "6080"
$env:SMTP_PORT = "2525"
go run ./cmd/api
```

Or use repo root `start-propfirm.ps1` (starts this API + Next.js).

## Tests

```powershell
go test ./...
go test -tags=integration ./tests/integration/...
```

## Seed users

- `trader@propfirm.local` / `Trader1!`
- `admin@propfirm.local` / `Admin1!`
