# PropFirm — User Stories (FundingPips-aligned)

Persona: **Visitor** · **Trader** · **Admin** · **System**

Stories reflect the current Next.js UI (app shell, mobile nav, auth, settings, tools, affiliate, security login history).

---

## Epic A — Identity & auth screens

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-A1 | Visitor | to register with email/password | I get a trader account | `/register` creates session and lands on accounts | Users |
| US-A2 | Visitor | to sign in on a FundingPips-style login | I recognize the product | Centered lockup, “Sign in to your account”, email/password, Remember Me, Forgot Password, Google stub, Create account | Users |
| US-A3 | Trader | to stay signed in with JWT | I can call protected APIs | Bearer token in `localStorage`; `/api/users/me` works | Users |
| US-A4 | Trader | to log out from desktop sidebar or mobile menu | my session ends | Clears token and navigates to `/login` | Users |
| US-A5 | Visitor | to request a password reset | I can recover access | `/forgot-password` demo form (no email required for MVP) | Users |
| US-A6 | Trader | theme toggle on auth and in-app | I can use light/dark | `data-theme` persisted in `localStorage` | Users (UI) |

---

## Epic B — Challenge catalog & configurator

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-B1 | Visitor | to see “Buckle Up, Your Journey Starts Here!” | I understand evaluations are for sale | Headline + subtitle on home | Catalog |
| US-B2 | Visitor | to pick **currency** (USD/EUR/GBP/CHF/CAD/INR) | prices match my region | Prices convert with fixed FX; symbol updates | Catalog (display) |
| US-B3 | Visitor | to choose **phase family**: Zero · 1 Step Flex · 2 Step | I match my skill/budget | Segmented control; selection filters products | Catalog |
| US-B4 | Visitor | to choose **variant**: Standard · Flex · Pro | I optimize split / max loss / target | Sub-labels visible | Catalog |
| US-B5 | Visitor | to choose **account size** 5K–100K | I buy the right capital | Size pills/cards | Catalog |
| US-B6 | Visitor | to see **pricing cards** with rules | I compare before buying | Price, compare-at, targets, losses, days, split | Catalog |
| US-B7 | Visitor | to see **Most popular** on 100K | I trust the recommended size | Badge on highlighted card | Catalog |
| US-B8 | Visitor | to toggle **Swap Free (+10%)** | overnight fees are optional | Checkout price = base × 1.10 when on | Commerce |
| US-B9 | Visitor | to click **Buy Challenge** | I start checkout | Navigates to checkout with product + addon | Commerce |
| US-B10 | Visitor | to add challenges to a **basket** | I can buy multiple | Sidebar/mobile basket badge + drawer | Commerce |
| US-B11 | Admin | seeded matrix of phase×variant×size | demos work offline | Seeded catalog in Postgres | Catalog |

---

## Epic C — Purchase

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-C1 | Trader | checkout for selected product | purchase matches UI | Order snapshots rules/addon | Commerce |
| US-C2 | Trader | confirm mock payment | challenge is created | Paid → ChallengeInstance | Commerce, Challenges |
| US-C5 | Trader | Swap Free on the order | I pay the uplift | Stored on order | Commerce |

---

## Epic D–F — Challenge lifecycle, trading, risk

| ID | Note |
|----|------|
| US-D1… | Accounts workspace lists challenges; detail panel shows login/platform |
| US-D6 | 2-Step uses Phase 1 then Phase 2 targets |
| US-E* | Simulated trading from account detail |
| US-F1–F3 | Daily loss / max DD / profit target rules (pure domain `evaluateRisk`) |
| US-F5 | Risk uses current phase target % |

---

## Epic G — Rewards & payouts

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-G1 | Trader | to see wallet / rewards UI at `/payouts` | I track earnings | Rewards page loads for signed-in trader | Payouts |
| US-G2 | Trader | to request a payout | I withdraw profits | Request flow + admin approval path | Payouts |

---

## Epic H — Notifications & audit

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-H1 | System | to email via SMTP (Mailpit locally) | traders get notices | Mailpit UI `:8026` receives messages | Notifications |
| US-H2 | Admin | to see audit entries | I can investigate | `/admin` audit list | Audit |

---

## Epic I — App shell & navigation (FundingPips UX)

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-I1 | Trader | a desktop icon sidebar | I navigate quickly | Brand, basket, bell, nav through Affiliate; Settings / theme / logout pinned bottom | UI |
| US-I2 | Trader | a mobile sticky header + full-screen menu | I can navigate on phone | Lockup, bell, basket, hamburger; primary + secondary link groups; dark mode + logout footer | UI |
| US-I3 | Trader | Phosphor-style icons matching FundingPips | the product feels familiar | Trade Copier = broadcast/wireless, Rewards = coins, etc. | UI |
| US-I4 | Trader | a floating support chat bubble | I can ask for help | Chat FAB on app + auth routes | UI |

---

## Epic J — Trader tools & content pages

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-J1 | Trader | Certificates gallery | I can view/print payout certificates | `/certificates` | UI |
| US-J2 | Trader | Economic Calendar | I plan around news | Filters + event list `/economic-calendar` | UI |
| US-J3 | Trader | Trading Tools hub + risk calculator | I size positions | `/tools`, `/tools/risk-calculator` | UI |
| US-J4 | Trader | Trade Copier entry | I find copy-trading | `/trade-copier` | UI |
| US-J5 | Trader | Competitions & Leaderboards | I compete socially | `/competitions`, `/leaderboards` | UI |
| US-J6 | Trader | Affiliate dashboard | I track referrals | `/affiliate` earnings/rewards tabs | UI |

---

## Epic K — Settings / configuration

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-K1 | Trader | Profile details | I keep KYC-ish data | `/settings/profile` form (local persistence) | Users |
| US-K2 | Trader | Verify / Security / payment methods | I manage account safety | Verify, 2FA toggle, bank/cards/crypto stubs | Users |
| US-K3 | Trader | **Login History** with IP intelligence | I spot VPN/VPS vs real IP | Table/cards: when, IP, country, connection kind, ISP; filled on each login | Users / Security |
| US-K4 | Trader | Preferences / Discord / suggestions | I customize the account | Dedicated settings routes | Users |

---

## Testing stories

| ID | As a… | I want… | So that… | Acceptance |
|----|-------|---------|----------|------------|
| US-T1 | Dev | backend unit tests for risk + IP intel | regressions are caught | `npm test` in `backend/` |
| US-T2 | Dev | backend integration tests for auth/history | API contracts hold | `test/integration` against `:6080` |
| US-T3 | Dev | frontend unit tests for libs | calculators/formatters stay correct | `npm test` in `frontend/` |
| US-T4 | Dev | Playwright e2e smokes | critical UX paths work | login → security history; mobile menu |

---

## MVP priority (current)

1. Auth UX (US-A2–A6) + shell (US-I*)  
2. Catalog → checkout (US-B*, US-C*)  
3. Accounts + risk (US-D*, US-F*)  
4. Settings + login history (US-K3)  
5. Tools / certificates / calendar / affiliate (US-J*)  
6. Automated tests (US-T*)  
