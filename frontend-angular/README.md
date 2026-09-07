# PropFirm Angular frontend (Angular 21 LTS)

Angular port of the PropFirm trader UI. Talks to the .NET API on **:6080** via the Angular CLI proxy so `/api/*` stays same-origin and httpOnly JWT cookies work (`credentials: 'include'`).

## Prerequisites

- Node.js 20+
- PropFirm API running on `http://localhost:6080` (cookie JWT auth)

## Install & run

```bash
cd propfirm/frontend-angular
npm install
npm start
```

Opens **http://localhost:3200** (`ng serve --port 3200 --host 0.0.0.0` with `proxy.conf.json`).

## Proxy

`proxy.conf.json` forwards `/api` → `http://localhost:6080` with `changeOrigin: true`, `secure: false`, and cookie rewrite helpers.

## Demo login

- Trader: `trader@propfirm.local` / `Trader1!`
- Admin lands on `/admin` after sign-in

## Stack notes

- Standalone components, signals, `inject()`, functional guards
- Auth bootstrap: `GET /api/users/me`
- Accounts list: `GET /api/challenges` (same contract as the React `AccountsWorkspace`)
