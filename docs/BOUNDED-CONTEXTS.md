# PropFirm — Bounded Contexts (from user stories)

Derived from [USER-STORIES.md](USER-STORIES.md). Modular monolith: **one NestJS process**, **Postgres schema per BC**, cross-BC talk only via **integration events**.

---

## Context map

```
                    ┌────────────┐
                    │   Users    │
                    └─────┬──────┘
                          │ owns Trader identity
                          ▼
┌──────────┐  buy   ┌──────────┐  ChallengePurchased  ┌────────────┐
│ Catalog  │───────►│ Commerce │─────────────────────►│ Challenges │
└──────────┘        └──────────┘                      └─────┬──────┘
                                                            │ starts
                              ┌──────────┐                  │
                              │  Trading │◄─────────────────┘
                              └────┬─────┘
                                   │ TradeRecorded / EquityUpdated
                                   ▼
                              ┌──────────┐  breach/pass
                              │   Risk   │──────────────► Challenges
                              └──────────┘                    │
                                                              │ Funded
                                                              ▼
                                                         ┌─────────┐
                                                         │ Payouts │
                                                         └─────────┘

Notifications + AuditHub subscribe to integration events (side effects only).
```

---

## Contexts

| Context | Schema | Owns | Stories | Publishes | Subscribes |
|---------|--------|------|---------|-----------|------------|
| **Users** | `users` | Trader identity, JWT claims | A1–A4 | `UserRegisteredEvent` | — |
| **Catalog** | `catalog` | Products & rule templates | B1–B3 | `ProductListedEvent` (optional) | — |
| **Commerce** | `commerce` | Orders & payment intents | C1–C3 | `ChallengePurchasedEvent` | — |
| **Challenges** | `challenges` | ChallengeInstance lifecycle | C4, D1–D5 | `ChallengeStartedEvent`, `ChallengePassedEvent`, `ChallengeFailedEvent`, `ChallengeFundedEvent` | `ChallengePurchasedEvent`, Risk outcomes |
| **Trading** | `trading` | Accounts, trades, equity | D3, E1–E4 | `TradeRecordedEvent`, `EquityUpdatedEvent` | `ChallengeStartedEvent`, `ChallengeFailedEvent` (lock) |
| **Risk** | `risk` | Rule evaluation & breaches | F1–F4 | `RiskBreachEvent`, `EvaluationTargetReachedEvent` | Trading events |
| **Payouts** | `payouts` | Wallet & payout requests | G1–G4 | `PayoutCompletedEvent` | `ChallengeFundedEvent` |
| **Notifications** | `notifications` | Outbox + SMTP | H1, G4 | — | Pass/fail/payout events |
| **AuditHub** | `audithub` | Event timeline | H2 | — | All integration events |

---

## Domain rules (invariants)

1. **Payment before challenge** — Challenges creates an instance only after `ChallengePurchasedEvent` (paid order).  
2. **Risk owns breach/pass decisions** — Challenges changes status from Risk events, not from raw PnL in controllers.  
3. **Trading writes equity; Risk reads snapshots** — no controller updates challenge status directly from a trade.  
4. **Funded before payout** — wallet credit only on `ChallengeFundedEvent`; payout ≤ available balance.  
5. **Domain ≠ ORM** — aggregates in `modules/*/domain`; TypeORM entities in `persistence/`.

---

## Catalog configurator (FundingPips-like)

Home page **Challenge Journey** maps to Catalog BC:

- `phaseFamily`: `zero` | `one_step_flex` | `two_step`
- `variant`: `standard` | `flex` | `pro` (2-Step)
- Account sizes 5K–100K with compare-at price, split, avg rewards
- Commerce accepts `addonSwapFree` (+10%)

See [USER-STORIES.md](USER-STORIES.md) epic B.

| Term | Meaning |
|------|---------|
| **Challenge product** | Sellable evaluation offer (size, price, phases, rule template) |
| **Challenge instance** | One purchased evaluation for one trader |
| **Phase** | Step in a multi-step evaluation (1-step or 2-step) |
| **Trading account** | Simulated funded balance tied to a challenge |
| **Breach** | Rule violation → challenge Failed |
| **Funded** | Passed all phases → eligible for payouts |
| **Wallet** | Ledger of withdrawable profit for funded traders |
