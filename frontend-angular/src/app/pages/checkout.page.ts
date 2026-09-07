import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { BasketCheckoutComponent } from '../components/basket-checkout.component';
import { BasketDrawerComponent } from '../components/basket-drawer.component';
import { readBasket, writeBasket } from '../lib/basket';
import type { BasketLine, CatalogProduct } from '../lib/basket-types';

/** Prevent writing empty basket before localStorage hydrate. */
let basketHydrated = false;

const FX: Record<string, { rate: number; symbol: string }> = {
  USD: { rate: 1, symbol: '$' },
  EUR: { rate: 0.92, symbol: '€' },
  GBP: { rate: 0.79, symbol: '£' },
  CHF: { rate: 0.88, symbol: 'Fr' },
  CAD: { rate: 1.36, symbol: 'C$' },
  INR: { rate: 83, symbol: '₹' },
};

const PHASES = [
  { id: 'zero', label: 'Zero' },
  { id: 'one_step_flex', label: '1 Step Flex', badge: 'New' },
  { id: 'two_step', label: '2 Step' },
] as const;

const VARIANTS = [
  { id: 'standard', label: 'Standard', hint: 'Highest profit split' },
  { id: 'pro', label: 'Pro', hint: 'Lowest profit target' },
  { id: 'flex', label: 'Flex', hint: 'Biggest max loss' },
] as const;

const PLATFORMS = [
  { id: 'mt5', label: 'MetaTrader 5', short: 'MT5', fee: 0 },
  { id: 'matchtrader', label: 'MatchTrader', short: 'MatchTrader', fee: 0 },
  { id: 'ctrader', label: 'cTrader', short: 'cTrader', fee: 20 },
] as const;

const MAX_ACCOUNTS = 10;

function sizeText(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function money(n: number, currency: string) {
  const fx = FX[currency] || FX['USD'];
  return `${fx.symbol}${(n * fx.rate).toFixed(2)}`;
}

function productTitle(p: CatalogProduct) {
  const phaseLabel = PHASES.find((x) => x.id === p.phaseFamily)?.label || p.phaseFamily;
  if (p.phaseFamily === 'two_step') {
    const v = VARIANTS.find((x) => x.id === p.variant)?.label || p.variant;
    return `${sizeText(p.accountSize)} · ${phaseLabel} ${v}`;
  }
  return `${sizeText(p.accountSize)} · ${phaseLabel}`;
}

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [FormsModule, RouterLink, BasketCheckoutComponent, BasketDrawerComponent],
  template: `
    <div class="cfg-page">
      @if (step() !== 'checkout') {
        <div class="promo-bar" aria-label="Social proof">
          <div class="promo-pill"><span class="stars trust" aria-hidden="true">★★★★★</span><span>Trustpilot</span><span>61k+</span></div>
          <div class="promo-pill"><span>4.8</span><span class="stars google" aria-hidden="true">★</span><span>Google</span></div>
          <span class="promo-sep" aria-hidden="true"></span>
          <p><strong>$302M+</strong> <span>Total Rewards</span></p>
          <span class="promo-sep" aria-hidden="true"></span>
          <p><strong>400k</strong> <span>Funding</span></p>
        </div>
      }

      <header class="cfg-sticky-header">
        <div class="cfg-sticky-inner">
          <a routerLink="/" class="cfg-logo" aria-label="PropFirm">PropFirm</a>
          <div class="cfg-sticky-sep" aria-hidden="true"></div>
          <div class="cfg-sticky-meta">
            <p class="cfg-sticky-title">{{ step() === 'checkout' ? 'Checkout' : displayName() }}</p>
            <p class="cfg-sticky-sub">
              {{
                step() === 'checkout'
                  ? basketCount() + ' challenge' + (basketCount() === 1 ? '' : 's')
                  : 'PropFirm · ' + platformMeta().label
              }}
            </p>
          </div>
          <p class="cfg-sticky-price">{{ money(step() === 'checkout' ? basketTotal() : total(), currency()) }}</p>
          <button type="button" class="cfg-basket-btn" aria-label="Basket" (click)="basketOpen.set(true)">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
              <path d="M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z" />
            </svg>
            @if (basketCount() > 0) {
              <span class="cfg-basket-badge">{{ basketCount() }}</span>
            }
          </button>
        </div>
      </header>

      <main class="cfg-main">
        @if (!booted() && !err()) {
          <p class="meta">Loading configurator…</p>
        } @else if (step() === 'checkout') {
          <app-basket-checkout
            [basket]="basket()"
            [currency]="currency()"
            (back)="onCheckoutBack()"
            (clear)="clearBasket()"
            (updateQty)="updateBasketQty($event.key, $event.qty)"
            (remove)="removeBasketItem($event)"
            (paid)="onBasketPaid($event)"
          />
        } @else {
          <form class="cfg-form" (ngSubmit)="$event.preventDefault(); goToBasketCheckout(true)">
            <div class="cfg-stack">
              <div id="configurator-challenge" class="cfg-section">
                <div class="cfg-section-head">
                  <label class="cfg-h2">Challenge Type</label>
                  <select aria-label="Display currency" class="cfg-currency" [ngModel]="currency()" (ngModelChange)="currency.set($event)" name="currency">
                    @for (c of fxKeys; track c) {
                      <option [value]="c">{{ c }}</option>
                    }
                  </select>
                </div>
                <div class="cfg-options" role="radiogroup" aria-label="Challenge type">
                  @for (p of phases; track p.id) {
                    <button type="button" role="radio" class="cfg-option" [class.on]="phase() === p.id" [attr.aria-checked]="phase() === p.id" (click)="setPhase(p.id)">
                      <span class="cfg-option-main">
                        <span>{{ p.label }}</span>
                        @if ('badge' in p && p.badge) {
                          <span class="cfg-new">{{ p.badge }}</span>
                        }
                      </span>
                      <span class="cfg-option-price">From {{ money(fromPrice(p.id), currency()) }}</span>
                    </button>
                  }
                </div>
                @if (phase() === 'two_step') {
                  <div class="cfg-model">
                    <label class="cfg-h2">Model Type</label>
                    <div class="cfg-options" role="radiogroup" aria-label="2 Step model type">
                      @for (v of variants; track v.id) {
                        <button type="button" role="radio" class="cfg-option stacked" [class.on]="variant() === v.id" (click)="variant.set(v.id)">
                          <span class="cfg-option-title">{{ v.label }}</span>
                          <span class="cfg-option-hint">{{ v.hint }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>

              <div id="configurator-account-size" class="cfg-section">
                <label class="cfg-h2">Account Size</label>
                <div class="cfg-options" role="radiogroup" aria-label="Account size">
                  @for (p of catalog(); track p.id) {
                    <button type="button" role="radio" class="cfg-option" [class.on]="selected()?.id === p.id" (click)="size.set(p.accountSize)">
                      <span class="cfg-size">{{ sizeText(p.accountSize) }}</span>
                      <span class="cfg-option-price">{{ money(p.price, currency()) }}</span>
                    </button>
                  }
                </div>
              </div>

              <div id="configurator-platform" class="cfg-section">
                <label class="cfg-h2">Trading Platform</label>
                <div class="cfg-options" role="radiogroup" aria-label="Trading platform">
                  @for (p of platforms; track p.id) {
                    <button type="button" role="radio" class="cfg-option" [class.on]="platform() === p.id" (click)="platform.set(p.id)">
                      <span class="cfg-platform-label">{{ p.label }}</span>
                      @if (p.fee > 0) {
                        <span class="cfg-option-price">+{{ money(p.fee, currency()) }}</span>
                      }
                    </button>
                  }
                </div>
              </div>

              <div id="configurator-customisation" class="cfg-section">
                <div class="cfg-customise-head">
                  <label class="cfg-h2">Customise Trading Rules</label>
                  <p class="cfg-h2 muted">Adjust your challenge parameters to match your trading style</p>
                </div>
                <div class="cfg-addon-block">
                  <div>
                    <label class="cfg-h3">Swap Free</label>
                    <p class="cfg-hint">Choose options for swap free</p>
                  </div>
                  <div class="cfg-options" role="radiogroup" aria-label="Swap free">
                    <button type="button" role="radio" class="cfg-option" [class.on]="!swapFree()" (click)="swapFree.set(false)"><span>No</span></button>
                    <button type="button" role="radio" class="cfg-option" [class.on]="swapFree()" (click)="swapFree.set(true)">
                      <span class="cfg-option-stacked-inline"><span>Yes</span><small>MT5 only</small></span>
                      <span class="cfg-option-price">+{{ money(selected() ? selected()!.price * 0.1 : 0, currency()) }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div id="add-challenge" class="cfg-section cfg-summary-wrap">
                <div class="cfg-summary-card">
                  <h3>{{ displayName() }}</h3>
                  <dl>
                    <div><dt>Model Type</dt><dd>PropFirm</dd></div>
                    <div><dt>Trading Platform</dt><dd>{{ platformMeta().label }}</dd></div>
                  </dl>
                </div>
                <div class="cfg-total">
                  <p>Total</p>
                  <div class="cfg-total-price">{{ money(total(), currency()) }}</div>
                </div>
                <div class="cfg-qty">
                  <span>Quantity</span>
                  <div class="cfg-qty-controls">
                    <button type="button" class="cfg-max" (click)="qty.set(10)">Max <span>|</span> <span>10</span></button>
                    <div class="cfg-stepper" role="group" aria-label="Quantity">
                      <button type="button" [disabled]="qty() <= 1" (click)="qty.set(Math.max(1, qty() - 1))">−</button>
                      <span>{{ qty() }}</span>
                      <button type="button" [disabled]="qty() >= 10" (click)="qty.set(Math.min(10, qty() + 1))">+</button>
                    </div>
                  </div>
                </div>
                @if (err()) {
                  <p class="err">{{ err() }}</p>
                }
                <div class="cfg-actions">
                  <button type="button" class="cfg-btn primary" [disabled]="!selected()" (click)="addToBasket()">Add to cart</button>
                  <button type="button" class="cfg-btn ghost" [disabled]="!selected()" (click)="goToBasketCheckout(true)">Buy now</button>
                </div>
              </div>
            </div>
          </form>
        }
      </main>

      <app-basket-drawer
        [open]="basketOpen()"
        [basket]="basket()"
        [currency]="currency()"
        (close)="basketOpen.set(false)"
        (clear)="clearBasket()"
        (updateQty)="updateBasketQty($event.key, $event.qty)"
        (remove)="removeBasketItem($event)"
        (continueCheckout)="goToBasketCheckout(false)"
      />
    </div>
  `,
})
export class CheckoutPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Math = Math;
  readonly money = money;
  readonly sizeText = sizeText;
  readonly phases = PHASES;
  readonly variants = VARIANTS;
  readonly platforms = PLATFORMS;
  readonly fxKeys = Object.keys(FX);

  readonly all = signal<CatalogProduct[]>([]);
  readonly phase = signal('two_step');
  readonly variant = signal('pro');
  readonly size = signal(5000);
  readonly currency = signal('USD');
  readonly platform = signal('mt5');
  readonly swapFree = signal(false);
  readonly qty = signal(1);
  readonly err = signal('');
  readonly booted = signal(false);
  readonly basketOpen = signal(false);
  readonly basket = signal<BasketLine[]>([]);
  readonly step = signal<'configure' | 'checkout'>('configure');

  readonly catalog = computed(() => {
    const phase = this.phase();
    const variant = this.variant();
    return this.all().filter((p) => {
      if (p.phaseFamily !== phase) return false;
      if (phase === 'two_step') return p.variant === variant;
      return true;
    });
  });

  readonly selected = computed(() => {
    const catalog = this.catalog();
    return catalog.find((p) => p.accountSize === this.size()) || catalog[0] || null;
  });

  readonly platformMeta = computed(() => PLATFORMS.find((p) => p.id === this.platform()) || PLATFORMS[0]);
  readonly unitBase = computed(() => {
    const selected = this.selected();
    if (!selected) return 0;
    return selected.price * (this.swapFree() ? 1.1 : 1) + this.platformMeta().fee;
  });
  readonly total = computed(() => this.unitBase() * this.qty());
  readonly displayName = computed(() => (this.selected() ? productTitle(this.selected()!) : '…'));
  readonly basketCount = computed(() => this.basket().reduce((n, i) => n + i.qty, 0));
  readonly basketTotal = computed(() => this.basket().reduce((n, i) => n + i.unitPrice * i.qty, 0));

  constructor() {
    effect(() => {
      const items = this.basket();
      const currency = this.currency();
      if (!basketHydrated) return;
      writeBasket(items, currency);
    });
    effect(() => {
      if (typeof document === 'undefined') return;
      document.body.style.overflow = this.basketOpen() ? 'hidden' : '';
    });
  }

  ngOnInit() {
    const stored = readBasket();
    this.basket.set(stored.items);
    if (stored.currency) this.currency.set(stored.currency);
    basketHydrated = true;
    const productId = this.route.snapshot.paramMap.get('productId') || '';
    if (this.route.snapshot.fragment === 'basket-checkout' || window.location.hash === '#basket-checkout') {
      this.step.set('checkout');
    }
    const addon = this.route.snapshot.queryParamMap.get('addon');
    if (addon === 'swapFree') this.swapFree.set(true);

    void this.api
      .request<CatalogProduct[]>('/api/catalog/products', { auth: false })
      .then(async (rows) => {
        this.all.set(rows);
        try {
          const seed = await this.api.request<CatalogProduct>(`/api/catalog/products/${productId}`, { auth: false });
          this.phase.set(seed.phaseFamily);
          this.variant.set(seed.variant);
          this.size.set(seed.accountSize);
        } catch {
          /* defaults */
        } finally {
          this.booted.set(true);
        }
      })
      .catch((e) => this.err.set(String(e.message || e)));
  }

  fromPrice(phaseId: string) {
    const byPhase = (pf: string, v?: string) => {
      const rows = this.all().filter((p) => p.phaseFamily === pf && (!v || p.variant === v));
      if (!rows.length) return 0;
      return Math.min(...rows.map((p) => p.price));
    };
    if (phaseId === 'zero') return byPhase('zero');
    if (phaseId === 'one_step_flex') return byPhase('one_step_flex');
    return Math.min(
      byPhase('two_step', 'standard') || Infinity,
      byPhase('two_step', 'pro') || Infinity,
      byPhase('two_step', 'flex') || Infinity,
    );
  }

  setPhase(id: string) {
    this.phase.set(id);
    if (id !== 'two_step') this.variant.set('flex');
  }

  addToBasket() {
    const selected = this.selected();
    if (!selected) return;
    const key = `${selected.id}|${this.platform()}|${this.swapFree() ? 1 : 0}`;
    const qty = this.qty();
    const existing = this.basket().find((i) => i.key === key);
    if (existing) {
      this.basket.set(
        this.basket().map((i) =>
          i.key === key ? { ...i, qty: Math.min(MAX_ACCOUNTS, i.qty + qty) } : i,
        ),
      );
    } else {
      this.basket.set([
        ...this.basket(),
        {
          key,
          productId: selected.id,
          title: productTitle(selected),
          platform: this.platform(),
          platformShort: this.platformMeta().short,
          accountSize: selected.accountSize,
          unitPrice: this.unitBase(),
          swapFree: this.swapFree(),
          qty,
        },
      ]);
    }
    this.basketOpen.set(true);
  }

  clearBasket() {
    this.basket.set([]);
  }

  updateBasketQty(key: string, nextQty: number) {
    this.basket.set(
      this.basket()
        .map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_ACCOUNTS, Math.max(0, nextQty)) } : i))
        .filter((i) => i.qty > 0),
    );
  }

  removeBasketItem(key: string) {
    this.basket.set(this.basket().filter((i) => i.key !== key));
  }

  ensureCurrentInBasket(): BasketLine[] {
    const selected = this.selected();
    if (!selected) return this.basket();
    const key = `${selected.id}|${this.platform()}|${this.swapFree() ? 1 : 0}`;
    const existing = this.basket().find((i) => i.key === key);
    if (existing) {
      return this.basket().map((i) =>
        i.key === key ? { ...i, qty: Math.min(MAX_ACCOUNTS, Math.max(i.qty, this.qty())) } : i,
      );
    }
    return [
      ...this.basket(),
      {
        key,
        productId: selected.id,
        title: productTitle(selected),
        platform: this.platform(),
        platformShort: this.platformMeta().short,
        accountSize: selected.accountSize,
        unitPrice: this.unitBase(),
        swapFree: this.swapFree(),
        qty: this.qty(),
      },
    ];
  }

  goToBasketCheckout(fromCurrent = false) {
    const next = fromCurrent || !this.basket().length ? this.ensureCurrentInBasket() : this.basket();
    this.basket.set(next);
    this.basketOpen.set(false);
    this.step.set('checkout');
    window.history.replaceState(null, '', `${window.location.pathname}#basket-checkout`);
  }

  onCheckoutBack() {
    this.step.set('configure');
    window.history.replaceState(null, '', window.location.pathname);
    requestAnimationFrame(() => {
      document.getElementById('configurator-challenge')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  onBasketPaid(challengeId?: string) {
    this.basket.set([]);
    writeBasket([], this.currency());
    if (challengeId) {
      void this.router.navigateByUrl(`/challenges/${challengeId}`);
    } else {
      void this.router.navigateByUrl('/accounts');
    }
  }
}
