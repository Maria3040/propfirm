import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  phaseFamily: string;
  variant: string;
  variantTagline: string | null;
  accountSize: number;
  price: number;
  comparePrice: number | null;
  phases: number;
  phase1TargetPct: number;
  phase2TargetPct: number;
  dailyLossPct: number;
  maxLossPct: number;
  minTradingDays: number;
  profitSplitPct: number;
  rewardCycle: string;
  avgFirstReward: number;
  isMostPopular: boolean;
};

const FX: Record<string, { rate: number; symbol: string; flag: string }> = {
  USD: { rate: 1, symbol: '$', flag: '🇺🇸' },
  EUR: { rate: 0.92, symbol: '€', flag: '🇪🇺' },
  GBP: { rate: 0.79, symbol: '£', flag: '🇬🇧' },
  CHF: { rate: 0.88, symbol: 'Fr', flag: '🇨🇭' },
  CAD: { rate: 1.36, symbol: 'C$', flag: '🇨🇦' },
  INR: { rate: 83, symbol: '₹', flag: '🇮🇳' },
};

/** Same phase tabs as React ChallengeJourney. */
const PHASES = [
  { id: 'zero', label: 'Zero' },
  { id: 'one_step_flex', label: '1 Step Flex', badge: 'New' },
  { id: 'two_step', label: '2 Step' },
] as const;

/** Same model tabs as React: Standard / Flex / Pro (shown when phase = 2 Step). */
const VARIANTS = [
  { id: 'standard', label: 'Standard', hint: 'Highest Profit Split' },
  { id: 'flex', label: 'Flex', hint: 'Biggest Max Loss' },
  { id: 'pro', label: 'Pro', hint: 'Lowest Profit Target' },
] as const;

const STANDARD_CYCLES = [
  { cycle: 'Biweekly', split: 80 },
  { cycle: 'Weekly', split: 75 },
  { cycle: 'Monthly', split: 85 },
] as const;

function sizeLabel(n: number) {
  return n >= 1000 ? `$${n / 1000}K` : `$${n}`;
}

function daysLabel(n: number) {
  if (n <= 0) return '—';
  if (n === 1) return '1 day';
  return `${n} days`;
}

@Component({
  selector: 'app-challenge-journey',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="journey">
      <div class="journey-head">
        <h2>Buckle Up, Your Journey Starts Here!</h2>
        <p>1 Step, 2 Step, or Zero. Multiple routes to match your trading style and budget.</p>
      </div>

      @if (err()) {
        <p class="err">{{ err() }}</p>
      }

      <div class="journey-toolbar desktop-only">
        <div class="pill-group">
          <span class="flag">{{ fx().flag }}</span>
          <select aria-label="Select currency" [value]="currency()" (change)="onCurrency($event)">
            @for (c of currencyKeys; track c) {
              <option [value]="c">{{ FX[c].symbol }}</option>
            }
          </select>
        </div>

        <div class="toolbar-center">
          <div class="seg" role="radiogroup" aria-label="Select challenge phase">
            @for (p of PHASES; track p.id) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="phase() === p.id"
                [class.on]="phase() === p.id"
                (click)="setPhase(p.id)"
              >
                {{ p.label }}
                @if ('badge' in p && p.badge) {
                  <span class="new-badge">{{ p.badge }}</span>
                }
              </button>
            }
          </div>
          @if (phase() === 'two_step') {
            <div class="seg seg-sm" role="radiogroup" aria-label="Select challenge variant">
              @for (v of VARIANTS; track v.id) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="variant() === v.id"
                  [class.on]="variant() === v.id"
                  (click)="setVariant(v.id)"
                >
                  <span>{{ v.label }}</span>
                  <small>{{ v.hint }}</small>
                </button>
              }
            </div>
          }
        </div>

        <div class="pill-group spacer" aria-hidden="true"></div>
      </div>

      <div class="journey-mobile mobile-only">
        <div class="seg" role="radiogroup">
          @for (p of PHASES; track p.id) {
            <button type="button" [class.on]="phase() === p.id" (click)="setPhase(p.id)">
              {{ p.label }}
            </button>
          }
        </div>
        @if (phase() === 'two_step') {
          <div class="seg seg-sm" role="radiogroup">
            @for (v of VARIANTS; track v.id) {
              <button type="button" [class.on]="variant() === v.id" (click)="setVariant(v.id)">
                <span>{{ v.label }}</span>
                <small>{{ v.hint }}</small>
              </button>
            }
          </div>
        }
      </div>

      <label class="addon">
        <input type="checkbox" [checked]="swapFree()" (change)="swapFree.set($any($event.target).checked)" />
        Add-on: <strong>Swap Free (+10%)</strong>
      </label>

      <div class="journey-grid-wrap">
        <div class="journey-grid">
          @for (p of homeProducts(); track p.id) {
            <article class="pf-card" [class.featured]="p.isMostPopular">
              <div class="pf-card-badge-slot">
                @if (p.isMostPopular) {
                  <p class="popular">Most popular</p>
                }
              </div>

              <div class="pf-card-body">
                <div class="pf-mobile-price">
                  <div class="pf-mobile-price-line">
                    <p class="pf-display-price">{{ priceText(p) }}</p>
                    @if (compareText(p); as cmp) {
                      <del>{{ cmp }}</del>
                    }
                  </div>
                  <p class="for-size">for {{ sizeLabel(p.accountSize) }} Account</p>
                  <p class="addon-hint">Add-on available: <span>Swap Free (+10%)</span></p>
                </div>

                <div class="pf-price-row">
                  <span class="label">Account size</span>
                  <span class="label end">Price</span>
                  <span class="size">{{ sizeLabel(p.accountSize) }}</span>
                  <span class="price-line">
                    @if (compareText(p); as cmp) {
                      <del>{{ cmp }}</del>
                    }
                    <span class="price-now">
                      <span class="sym">{{ fx().symbol }}</span>{{ priceNum(p).toLocaleString() }}
                    </span>
                  </span>
                </div>

                <a class="buy" [routerLink]="['/checkout', p.id]" [queryParams]="checkoutQuery()">
                  <span>Buy Challenge</span>
                </a>
              </div>

              <div class="rules">
                <div class="rule-block">
                  <div class="rule-title">
                    Profit Target
                    <button
                      type="button"
                      class="info-tip"
                      aria-label="Profit Target: Reach the profit target while respecting the risk limits. There is no time pressure, so you can trade at your own pace."
                      title="Profit Target: Reach the profit target while respecting the risk limits. There is no time pressure, so you can trade at your own pace."
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
                      </svg>
                    </button>
                  </div>
                  <div class="rule-row">
                    <span>Phase 1</span>
                    <strong>{{ p.phase1TargetPct ? p.phase1TargetPct + '%' : '—' }}</strong>
                  </div>
                  <div class="rule-row">
                    <span>Phase 2</span>
                    <strong>{{ p.phase2TargetPct ? p.phase2TargetPct + '%' : '—' }}</strong>
                  </div>
                  <div class="rule-row">
                    <span>Master</span>
                    <strong>—</strong>
                  </div>
                </div>

                <div class="rule-row single">
                  <span class="rule-title">
                    Max Loss
                    <button
                      type="button"
                      class="info-tip"
                      aria-label="Max Loss: The amount you are allowed to lose overall"
                      title="Max Loss: The amount you are allowed to lose overall"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
                      </svg>
                    </button>
                  </span>
                  <strong>{{ p.maxLossPct }}%</strong>
                </div>

                <div class="rule-row single">
                  <span class="rule-title">
                    Daily Loss
                    <button
                      type="button"
                      class="info-tip"
                      aria-label="Daily Loss: The amount you are allowed to lose every day."
                      title="Daily Loss: The amount you are allowed to lose every day."
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
                      </svg>
                    </button>
                  </span>
                  <strong>{{ p.dailyLossPct }}%</strong>
                </div>

                <div class="rule-block">
                  <div class="rule-title">
                    Min Trading Days
                    <button
                      type="button"
                      class="info-tip"
                      aria-label="Min Trading Days: The minimum number of trading days required before completing the evaluation."
                      title="Min Trading Days: The minimum number of trading days required before completing the evaluation."
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
                      </svg>
                    </button>
                  </div>
                  <div class="rule-row">
                    <span>Evaluation Stage</span>
                    <strong>{{ daysLabel(p.minTradingDays) }}</strong>
                  </div>
                </div>

                <div class="rule-row single">
                  <span class="rule-title">
                    Split
                    <button type="button" class="info-tip" [attr.aria-label]="splitTip(p)" [title]="splitTip(p)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
                      </svg>
                    </button>
                  </span>
                  @if (p.variant === 'standard') {
                    <button type="button" class="split-cycle" aria-label="Change reward cycle" (click)="bumpCycle(p.id)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z" />
                      </svg>
                      <span>{{ cycleFor(p.id).cycle }} · {{ cycleFor(p.id).split }}%</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                        <path d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z" />
                      </svg>
                    </button>
                  } @else if (p.variant === 'pro') {
                    <strong class="split-val">{{ p.rewardCycle }} · {{ p.profitSplitPct }}%</strong>
                  } @else {
                    <strong class="split-val">{{ p.rewardCycle }} Up to {{ p.profitSplitPct }}%</strong>
                  }
                </div>
              </div>

              <p class="avg">
                Traders earn
                <strong>{{ fx().symbol }}{{ avgReward(p).toLocaleString() }}</strong>
                avg first rewards
              </p>
            </article>
          }
        </div>
      </div>
    </section>
  `,
})
export class ChallengeJourneyComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly FX = FX;
  readonly PHASES = PHASES;
  readonly VARIANTS = VARIANTS;
  readonly currencyKeys = Object.keys(FX);

  readonly phase = signal<string>('two_step');
  readonly variant = signal<string>('flex');
  readonly currency = signal('USD');
  readonly swapFree = signal(false);
  readonly products = signal<CatalogProduct[]>([]);
  readonly err = signal('');
  readonly cycleIdx = signal<Record<string, number>>({});

  /** Reactive — same filter as React `homeProducts`. */
  readonly fx = computed(() => FX[this.currency()] ?? FX['USD']);
  readonly homeProducts = computed(() => this.products().filter((p) => p.accountSize <= 100000));

  ngOnInit() {
    this.load();
  }

  sizeLabel = sizeLabel;
  daysLabel = daysLabel;

  setPhase(id: string) {
    this.phase.set(id);
    this.load();
  }

  setVariant(id: string) {
    this.variant.set(id);
    this.load();
  }

  onCurrency(ev: Event) {
    this.currency.set((ev.target as HTMLSelectElement).value);
  }

  private load() {
    const q = new URLSearchParams({ phaseFamily: this.phase() });
    if (this.phase() === 'two_step') q.set('variant', this.variant());
    this.err.set('');
    void this.api
      .request<CatalogProduct[]>(`/api/catalog/products?${q}`, { auth: false })
      .then((list) => this.products.set(list))
      .catch((e: unknown) => this.err.set(e instanceof Error ? e.message : String(e)));
  }

  priceNum(p: CatalogProduct) {
    const fx = this.fx();
    return Math.round(p.price * (this.swapFree() ? 1.1 : 1) * fx.rate);
  }

  priceText(p: CatalogProduct) {
    return `${this.fx().symbol}${this.priceNum(p).toLocaleString()}`;
  }

  compareText(p: CatalogProduct): string | null {
    if (p.comparePrice == null) return null;
    const fx = this.fx();
    const n = Math.round(p.comparePrice * (this.swapFree() ? 1.1 : 1) * fx.rate);
    return `${fx.symbol}${n.toLocaleString()}`;
  }

  avgReward(p: CatalogProduct) {
    return Math.round(p.avgFirstReward * this.fx().rate);
  }

  checkoutQuery() {
    return this.swapFree() ? { addon: 'swapFree' } : {};
  }

  splitTip(p: CatalogProduct) {
    return p.variant === 'standard' || p.variant === 'pro'
      ? 'Split: Your reward split for the selected reward cycle.'
      : 'Split: 85% reward split is the default. 95% is available as an add-on';
  }

  cycleFor(id: string) {
    const idx = this.cycleIdx()[id] ?? 0;
    return STANDARD_CYCLES[idx % STANDARD_CYCLES.length];
  }

  bumpCycle(id: string) {
    this.cycleIdx.update((m) => ({ ...m, [id]: ((m[id] ?? 0) + 1) % STANDARD_CYCLES.length }));
  }
}
