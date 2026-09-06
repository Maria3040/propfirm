# Frontend tests

| Layer | Tool | Command |
|-------|------|---------|
| Unit | Vitest | `npm test` |
| E2E | Playwright (needs UI `:3100` + API) | `npm run test:e2e` |

## Notes

- Unit tests cover pure libs (risk calculator, accounts format, basket edge cases).
- Playwright smokes login, security login history, and mobile nav.
- **No frontend ORM** — the UI talks to Nest via REST; TypeORM lives only on the backend.
