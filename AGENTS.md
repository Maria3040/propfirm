# PropFirm agent notes

- Own git remote: `git@github.com:Maria3040/propfirm.git`
- Docs: `docs/USER-STORIES.md`, `docs/BOUNDED-CONTEXTS.md`, `docs/diagrams/`
- **Default (`master`)**: NestJS + TypeORM + Postgres · Next.js **REST** UI
- **This GraphQL track**: NestJS **GraphQL (Apollo)** + TypeORM + Postgres · Next.js **Apollo Client**
  - Branch: `feat/backend-nestjs-graphql-typeorm-postgres_frontend-nextjs-apollo`
  - Playground: `http://localhost:6080/graphql`
  - UI lab: `http://localhost:3100/graphql-lab`
- Ports: API 6080 · UI 3100 · Postgres 15433 · Mailpit 8026 / SMTP 2525
- DDD modular monolith: schema-per-BC, in-process bus, domain ≠ ORM
