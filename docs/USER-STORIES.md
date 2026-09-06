# PropFirm — User Stories (FundingPips-aligned)

Persona: **Visitor** · **Trader** · **Admin** · **System**

Stories below extend the original epics with a **FundingPips-like challenge configurator** on the home page.

---

## Epic B — Challenge catalog & configurator (expanded)

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-B1 | Visitor | to see “Buckle Up, Your Journey Starts Here!” | I understand evaluations are for sale | Headline + subtitle on home | Catalog |
| US-B2 | Visitor | to pick **currency** (USD/EUR/GBP/CHF/CAD/INR) | prices match my region | Prices convert with fixed FX; symbol updates | Catalog (display) |
| US-B3 | Visitor | to choose **phase family**: Zero · 1 Step Flex · 2 Step | I match my skill/budget | Segmented control; selection filters products | Catalog |
| US-B4 | Visitor | to choose **variant**: Standard · Flex · Pro | I optimize split / max loss / target | Sub-labels: Highest Profit Split / Biggest Max Loss / Lowest Profit Target | Catalog |
| US-B5 | Visitor | to choose **account size** 5K–100K | I buy the right capital | Mobile size pills; desktop shows size cards row | Catalog |
| US-B6 | Visitor | to see **pricing cards** with rules | I compare before buying | Price, compare-at, profit targets by phase, max/daily loss, min days, split, avg rewards | Catalog |
| US-B7 | Visitor | to see **Most popular** on 100K | I trust the recommended size | Badge on highlighted card | Catalog |
| US-B8 | Visitor | to toggle **Swap Free (+10%)** add-on | overnight fees are optional | Checkout price = base × 1.10 when on | Commerce |
| US-B9 | Visitor | to click **Buy Challenge** | I start checkout for that SKU | Navigates to `/checkout/{productId}?addon=swapFree` | Commerce |
| US-B10 | Visitor | to switch **Phases** compare mode | I see rules across phases | Toggle still shows cards; future: table view | Catalog |
| US-B11 | Admin | seeded matrix of phase×variant×size | demos work offline | At least 2-Step Flex sizes 5K–100K fully priced; other families seeded | Catalog |

---

## Epic A — Identity (unchanged core)

US-A1…A4 — register / login / me / admin (see prior doc).

---

## Epic C — Purchase (extended)

| ID | As a… | I want… | So that… | Acceptance | BC |
|----|-------|---------|----------|------------|-----|
| US-C1 | Trader | checkout for selected configurator product | purchase matches UI choice | Order snapshots phase/variant/rules/addon | Commerce |
| US-C2 | Trader | confirm mock payment | challenge is created | Paid → ChallengeInstance with phase targets | Commerce, Challenges |
| US-C5 | Trader | Swap Free reflected on order | I pay the uplift | `addonSwapFree` + `pricePaid` stored | Commerce |

---

## Epic D–H

Challenge lifecycle, simulated trading, risk (phase-aware targets), payouts, notifications, audit — as in prior USER-STORIES, with:

| ID | Note |
|----|------|
| US-D6 | 2-Step uses **Phase 1** then **Phase 2** profit targets from catalog |
| US-F5 | Risk evaluates against **current phase** target % |

---

## MVP priority (this iteration)

1. US-B1–B11 + configurator UI  
2. US-C1/C2/C5 wired to Buy Challenge  
3. US-D6 / US-F5 phase-aware risk  
4. Existing dashboard / simulate / payouts remain  
