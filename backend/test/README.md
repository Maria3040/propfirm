# Backend tests

| Layer | Location | Command |
|-------|----------|---------|
| Unit | `test/unit/` | `npm test -- test/unit` |
| Integration / e2e (needs API) | `test/integration/` | `API_BASE=http://localhost:6080 npm test -- test/integration` |
| All | | `npm test` |

Unit tests never need Postgres. Integration tests skip gracefully if `:6080` is down.
