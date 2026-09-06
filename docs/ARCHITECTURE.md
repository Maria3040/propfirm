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

## Diagrams

| File | Tool |
|------|------|
| [diagrams/propfirm-processes.bpmn](diagrams/propfirm-processes.bpmn) | [bpmn.io](https://demo.bpmn.io) |
| [diagrams/architecture-containers.puml](diagrams/architecture-containers.puml) | PlantUML |
| [diagrams/domain-classes.puml](diagrams/domain-classes.puml) | PlantUML |
| [diagrams/sequence-login-history.puml](diagrams/sequence-login-history.puml) | PlantUML |

Rendering modes (SSR/SSG/ISR/CSR) and frontend-ORM guidance: see root [README.md](../README.md).

See [USER-STORIES.md](USER-STORIES.md) and [BOUNDED-CONTEXTS.md](BOUNDED-CONTEXTS.md).
