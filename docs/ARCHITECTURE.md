# PropFirm — Architecture

Modular monolith + DDD (same approach as WW Travel Club NestJS twin).

```
frontend :3100  ──REST──►  NestJS :6080
                              │
                 shared-kernel / contracts / bus
                              │
              modules/*/domain  (aggregates + domain events)
                              │
                 TypeORM ──► Postgres schemas (per BC)
                              │
                 SMTP ──► Mailpit :8026
```

See [USER-STORIES.md](USER-STORIES.md) and [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md).
