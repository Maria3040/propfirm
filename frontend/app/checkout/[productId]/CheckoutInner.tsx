'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { CatalogProduct } from '@/components/ChallengeJourney';
import { BasketCheckout, type BasketLine } from '@/components/BasketCheckout';
import { BasketDrawer } from '@/components/BasketDrawer';
import { readBasket, writeBasket } from '@/lib/basket';

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

const SECTIONS = [
  { id: 'configurator-challenge', label: 'Challenge Type' },
  { id: 'configurator-rules', label: 'Challenge Rules' },
  { id: 'configurator-account-size', label: 'Account Size' },
  { id: 'configurator-platform', label: 'Trading Platform' },
  { id: 'configurator-customisation', label: 'Customise Trading Rules' },
  { id: 'add-challenge', label: 'Current configuration' },
] as const;

type BasketItem = BasketLine;

const MAX_ALLOCATION = 400_000;
const MAX_ACCOUNTS = 10;

function sizeText(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function daysLabel(n: number) {
  if (n <= 0) return 'N/A';
  return n === 1 ? '1 day' : `${n} days`;
}

function money(n: number, currency: string) {
  const fx = FX[currency];
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

function PropFirmMark() {
  return (
    <svg viewBox="0 0 120 28" className="cfg-logo" aria-label="PropFirm" role="img">
      <text
        x="0"
        y="21"
        fill="currentColor"
        fontFamily="var(--font), system-ui, sans-serif"
        fontSize="20"
        fontWeight="700"
        letterSpacing="-0.03em"
      >
        PropFirm
      </text>
    </svg>
  );
}

export default function CheckoutInner() {
  const { productId } = useParams<{ productId: string }>();
  const search = useSearchParams();
  const router = useRouter();

  const [all, setAll] = useState<CatalogProduct[]>([]);
  const [phase, setPhase] = useState('two_step');
  const [variant, setVariant] = useState('pro');
  const [size, setSize] = useState(5000);
  const [currency, setCurrency] = useState('USD');
  const [platform, setPlatform] = useState('mt5');
  const [swapFree, setSwapFree] = useState(search.get('addon') === 'swapFree');
  const [qty, setQty] = useState(1);
  const [mobileRuleTab, setMobileRuleTab] = useState(0);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const [err, setErr] = useState('');
  const [booted, setBooted] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [step, setStep] = useState<'configure' | 'checkout'>('configure');
  const [basketReady, setBasketReady] = useState(false);

  useEffect(() => {
    const stored = readBasket();
    setBasket(stored.items);
    if (stored.currency) setCurrency(stored.currency);
    setBasketReady(true);
  }, []);

  useEffect(() => {
    if (!basketReady) return;
    writeBasket(basket, currency);
  }, [basket, currency, basketReady]);

  useEffect(() => {
    if (!basketReady || typeof window === 'undefined') return;
    if (window.location.hash === '#basket-checkout' && basket.length) {
      setStep('checkout');
    }
  }, [basketReady, basket.length]);

  useEffect(() => {
    api<CatalogProduct[]>('/api/catalog/products', { auth: false })
      .then(async (rows) => {
        setAll(rows);
        try {
          const seed = await api<CatalogProduct>(`/api/catalog/products/${productId}`, {
            auth: false,
          });
          setPhase(seed.phaseFamily);
          setVariant(seed.variant);
          setSize(seed.accountSize);
        } catch {
          /* keep defaults */
        } finally {
          setBooted(true);
        }
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [productId]);

  useEffect(() => {
    const ids = SECTIONS.map((s) => s.id);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveSection(visible.target.id);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0.1, 0.4, 0.7] },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [booted]);

  const catalog = useMemo(() => {
    return all.filter((p) => {
      if (p.phaseFamily !== phase) return false;
      if (phase === 'two_step') return p.variant === variant;
      return true;
    });
  }, [all, phase, variant]);

  const selected =
    catalog.find((p) => p.accountSize === size) || catalog[0] || null;

  useEffect(() => {
    if (!catalog.length) return;
    if (!catalog.some((p) => p.accountSize === size)) {
      setSize(catalog[0].accountSize);
    }
  }, [catalog, size]);

  const fromPrices = useMemo(() => {
    const byPhase = (pf: string, v?: string) => {
      const rows = all.filter(
        (p) => p.phaseFamily === pf && (!v || p.variant === v),
      );
      if (!rows.length) return 0;
      return Math.min(...rows.map((p) => p.price));
    };
    return {
      zero: byPhase('zero'),
      one: byPhase('one_step_flex'),
      two: Math.min(
        byPhase('two_step', 'standard') || Infinity,
        byPhase('two_step', 'pro') || Infinity,
        byPhase('two_step', 'flex') || Infinity,
      ),
    };
  }, [all]);

  const platformMeta = PLATFORMS.find((p) => p.id === platform)!;
  const platformFee = platformMeta.fee;
  const unitBase = selected ? selected.price * (swapFree ? 1.1 : 1) + platformFee : 0;
  const total = unitBase * qty;
  const displayName = selected ? productTitle(selected) : '…';

  const basketCount = basket.reduce((n, i) => n + i.qty, 0);
  const basketTotal = basket.reduce((n, i) => n + i.unitPrice * i.qty, 0);
  const allocSize = basket.reduce((n, i) => n + i.accountSize * i.qty, 0);
  const allocPct = Math.min(100, (allocSize / MAX_ALLOCATION) * 100);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function addToBasket() {
    if (!selected) return;
    const key = `${selected.id}|${platform}|${swapFree ? 1 : 0}`;
    setBasket((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key
            ? { ...i, qty: Math.min(MAX_ACCOUNTS, i.qty + qty) }
            : i,
        );
      }
      return [
        ...prev,
        {
          key,
          productId: selected.id,
          title: productTitle(selected),
          platform,
          platformShort: platformMeta.short,
          accountSize: selected.accountSize,
          unitPrice: unitBase,
          swapFree,
          qty,
        },
      ];
    });
    setBasketOpen(true);
  }

  function updateBasketQty(key: string, next: number) {
    setBasket((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_ACCOUNTS, Math.max(1, next)) } : i))
        .filter((i) => i.qty > 0),
    );
  }

  function removeBasketItem(key: string) {
    setBasket((prev) => prev.filter((i) => i.key !== key));
  }

  function ensureCurrentInBasket(): BasketItem[] {
    if (!selected) return basket;
    const key = `${selected.id}|${platform}|${swapFree ? 1 : 0}`;
    const existing = basket.find((i) => i.key === key);
    if (existing) {
      return basket.map((i) =>
        i.key === key ? { ...i, qty: Math.min(MAX_ACCOUNTS, Math.max(i.qty, qty)) } : i,
      );
    }
    const line: BasketItem = {
      key,
      productId: selected.id,
      title: productTitle(selected),
      platform,
      platformShort: platformMeta.short,
      accountSize: selected.accountSize,
      unitPrice: unitBase,
      swapFree,
      qty,
    };
    return [...basket, line];
  }

  function goToBasketCheckout(fromCurrent = false) {
    const next = fromCurrent || !basket.length ? ensureCurrentInBasket() : basket;
    setBasket(next);
    setBasketOpen(false);
    setStep('checkout');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}#basket-checkout`);
      requestAnimationFrame(() => {
        document.getElementById('cart-checkout-heading')?.focus();
      });
    }
  }

  async function buyNowDirect() {
    const next = ensureCurrentInBasket();
    setBasket(next);
    setStep('checkout');
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.pathname}#basket-checkout`);
    }
  }

  if (!booted && !err) {
    return <p className="meta">Loading configurator…</p>;
  }

  if (step === 'checkout') {
    return (
      <div className="cfg-page">
        <header className="cfg-sticky-header">
          <div className="cfg-sticky-inner">
            <PropFirmMark />
            <div className="cfg-sticky-sep" aria-hidden="true" />
            <div className="cfg-sticky-meta">
              <p className="cfg-sticky-title">Checkout</p>
              <p className="cfg-sticky-sub">
                {basketCount} challenge{basketCount === 1 ? '' : 's'}
              </p>
            </div>
            <p className="cfg-sticky-price">{money(basketTotal, currency)}</p>
            <button
              type="button"
              className="cfg-basket-btn"
              aria-label="Basket"
              onClick={() => setBasketOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z" />
              </svg>
              {basketCount > 0 ? <span className="cfg-basket-badge">{basketCount}</span> : null}
            </button>
          </div>
        </header>

        <main className="cfg-main">
          <BasketCheckout
            basket={basket}
            currency={currency}
            money={money}
            onBack={() => {
              setStep('configure');
              if (typeof window !== 'undefined') {
                window.history.replaceState(null, '', window.location.pathname);
              }
              requestAnimationFrame(() => scrollTo('configurator-challenge'));
            }}
            onClear={() => setBasket([])}
            onUpdateQty={updateBasketQty}
            onRemove={removeBasketItem}
            onPaid={() => {
              setBasket([]);
              writeBasket([], currency);
              router.push('/accounts');
            }}
          />
        </main>

        <BasketDrawer
          open={basketOpen}
          basket={basket}
          currency={currency}
          onClose={() => setBasketOpen(false)}
          onClear={() => setBasket([])}
          onUpdateQty={updateBasketQty}
          onRemove={removeBasketItem}
          onContinue={() => setBasketOpen(false)}
        />
      </div>
    );
  }

  const rules = selected
    ? {
        p1: {
          target: selected.phase1TargetPct ? `${selected.phase1TargetPct}%` : '—',
          daily: `${selected.dailyLossPct}%`,
          max: `${selected.maxLossPct}%`,
          days: daysLabel(selected.minTradingDays),
        },
        p2: {
          target: selected.phase2TargetPct ? `${selected.phase2TargetPct}%` : '—',
          daily: `${selected.dailyLossPct}%`,
          max: `${selected.maxLossPct}%`,
          days: daysLabel(selected.minTradingDays),
        },
        master: {
          target: '—',
          daily: `${selected.dailyLossPct}%`,
          max: `${selected.maxLossPct}%`,
          days: 'N/A',
        },
      }
    : null;

  const ruleTabs = [
    { key: 'p1', label: 'P1' },
    { key: 'p2', label: 'P2' },
    { key: 'master', label: 'Master' },
  ] as const;

  return (
    <div className="cfg-page">
      <div className="promo-bar" aria-label="Social proof">
        <div className="promo-pill">
          <span className="stars trust" aria-hidden="true">
            ★★★★★
          </span>
          <span>Trustpilot</span>
          <span>61k+</span>
        </div>
        <div className="promo-pill">
          <span>4.8</span>
          <span className="stars google" aria-hidden="true">
            ★
          </span>
          <span>Google</span>
        </div>
        <span className="promo-sep" aria-hidden="true" />
        <p>
          <strong>$302M+</strong> <span>Total Rewards</span>
        </p>
        <span className="promo-sep" aria-hidden="true" />
        <p>
          <strong>400k</strong> <span>Funding</span>
        </p>
      </div>

      <header className="cfg-sticky-header">
        <div className="cfg-sticky-inner">
          <PropFirmMark />
          <div className="cfg-sticky-sep" aria-hidden="true" />
          <div className="cfg-sticky-meta">
            <p className="cfg-sticky-title">{displayName}</p>
            <p className="cfg-sticky-sub">
              PropFirm · {platformMeta.label}
            </p>
          </div>
          <p className="cfg-sticky-price">{money(total, currency)}</p>
          <button
            type="button"
            className="cfg-basket-btn"
            aria-label="Basket"
            title="Basket"
            aria-haspopup="dialog"
            aria-expanded={basketOpen}
            onClick={() => setBasketOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
              <path d="M136,120v56a8,8,0,0,1-16,0V120a8,8,0,0,1,16,0Zm36.84-.8-5.6,56A8,8,0,0,0,174.4,184a7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.95-7.2l5.6-56a8,8,0,0,0-15.92-1.6Zm-89.68,0a8,8,0,0,0-15.92,1.6l5.6,56a8,8,0,0,0,8,7.2,7.32,7.32,0,0,0,.81,0,8,8,0,0,0,7.16-8.76ZM239.93,89.06,224.86,202.12A16.06,16.06,0,0,1,209,216H47a16.06,16.06,0,0,1-15.86-13.88L16.07,89.06A8,8,0,0,1,24,80H68.37L122,18.73a8,8,0,0,1,12,0L187.63,80H232a8,8,0,0,1,7.93,9.06ZM89.63,80h76.74L128,36.15ZM222.86,96H33.14L47,200H209Z" />
            </svg>
            {basketCount > 0 ? (
              <span className="cfg-basket-badge">{basketCount}</span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="cfg-main">
        <nav className="cfg-rail" aria-label="Configure a challenge">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-label={s.label}
              aria-current={activeSection === s.id ? 'step' : undefined}
              className={activeSection === s.id ? 'on' : ''}
              onClick={() => scrollTo(s.id)}
            >
              <span />
            </button>
          ))}
        </nav>

        <form
          className="cfg-form"
          onSubmit={(e) => {
            e.preventDefault();
            goToBasketCheckout(true);
          }}
        >
          <section aria-labelledby="challenge-configuration-heading">
            <h2 className="sr-only" id="challenge-configuration-heading">
              Configure a challenge
            </h2>

            <div className="cfg-stack">
              <div id="configurator-challenge" className="cfg-section">
                <div className="cfg-section-head">
                  <label className="cfg-h2">Challenge Type</label>
                  <select
                    aria-label="Display currency"
                    className="cfg-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {Object.keys(FX).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cfg-options" role="radiogroup" aria-label="Challenge type">
                  {PHASES.map((p) => {
                    const from =
                      p.id === 'zero'
                        ? fromPrices.zero
                        : p.id === 'one_step_flex'
                          ? fromPrices.one
                          : fromPrices.two;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={phase === p.id}
                        className={`cfg-option ${phase === p.id ? 'on' : ''}`}
                        onClick={() => {
                          setPhase(p.id);
                          if (p.id !== 'two_step') setVariant('flex');
                        }}
                      >
                        <span className="cfg-option-main">
                          <span>{p.label}</span>
                          {'badge' in p && p.badge ? (
                            <span className="cfg-new">{p.badge}</span>
                          ) : null}
                        </span>
                        <span className="cfg-option-price">
                          From {money(from || 0, currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {phase === 'two_step' && (
                  <div className="cfg-model">
                    <label className="cfg-h2">Model Type</label>
                    <div
                      className="cfg-options"
                      role="radiogroup"
                      aria-label="2 Step model type"
                    >
                      {VARIANTS.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={variant === v.id}
                          className={`cfg-option stacked ${variant === v.id ? 'on' : ''}`}
                          onClick={() => setVariant(v.id)}
                        >
                          <span className="cfg-option-title">{v.label}</span>
                          <span className="cfg-option-hint">{v.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div id="configurator-rules" className="cfg-section">
                <div className="cfg-rules-intro">
                  <h2 className="cfg-h2">Challenge Rules</h2>
                  <p>Understand the targets and limits for each stage.</p>
                </div>

                {rules && (
                  <>
                    <div className="cfg-rules-mobile">
                      <div className="cfg-tabs" role="tablist">
                        {ruleTabs.map((t, i) => (
                          <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={mobileRuleTab === i}
                            className={mobileRuleTab === i ? 'on' : ''}
                            onClick={() => setMobileRuleTab(i)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <dl>
                        {(
                          [
                            ['Target', rules[ruleTabs[mobileRuleTab].key].target],
                            ['Daily Loss', rules[ruleTabs[mobileRuleTab].key].daily],
                            ['Max Loss', rules[ruleTabs[mobileRuleTab].key].max],
                            ['Min. Trading Days', rules[ruleTabs[mobileRuleTab].key].days],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k} className="cfg-rule-row">
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="cfg-rules-desktop">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">
                              <span className="sr-only">Challenge Rules</span>
                            </th>
                            <th scope="col">P1</th>
                            <th scope="col">P2</th>
                            <th scope="col">Master</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th scope="row">Target</th>
                            <td>{rules.p1.target}</td>
                            <td>{rules.p2.target}</td>
                            <td>{rules.master.target}</td>
                          </tr>
                          <tr>
                            <th scope="row">Daily Loss</th>
                            <td>{rules.p1.daily}</td>
                            <td>{rules.p2.daily}</td>
                            <td>{rules.master.daily}</td>
                          </tr>
                          <tr>
                            <th scope="row">Max Loss</th>
                            <td>{rules.p1.max}</td>
                            <td>{rules.p2.max}</td>
                            <td>{rules.master.max}</td>
                          </tr>
                          <tr>
                            <th scope="row">Min. Trading Days</th>
                            <td>{rules.p1.days}</td>
                            <td>{rules.p2.days}</td>
                            <td>{rules.master.days}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              <div id="configurator-account-size" className="cfg-section">
                <label className="cfg-h2">Account Size</label>
                <div className="cfg-options" role="radiogroup" aria-label="Account size">
                  {catalog.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected?.id === p.id}
                      className={`cfg-option ${selected?.id === p.id ? 'on' : ''}`}
                      onClick={() => setSize(p.accountSize)}
                    >
                      <span className="cfg-size">{sizeText(p.accountSize)}</span>
                      <span className="cfg-option-price">{money(p.price, currency)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div id="configurator-platform" className="cfg-section">
                <label className="cfg-h2">Trading Platform</label>
                <div className="cfg-options" role="radiogroup" aria-label="Trading platform">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={platform === p.id}
                      className={`cfg-option ${platform === p.id ? 'on' : ''}`}
                      onClick={() => setPlatform(p.id)}
                    >
                      <span className="cfg-platform-label">{p.label}</span>
                      {p.fee > 0 ? (
                        <span className="cfg-option-price">+{money(p.fee, currency)}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div id="configurator-customisation" className="cfg-section">
                <div className="cfg-customise-head">
                  <label className="cfg-h2">Customise Trading Rules</label>
                  <p className="cfg-h2 muted">
                    Adjust your challenge parameters to match your trading style
                  </p>
                </div>
                <div className="cfg-addon-block">
                  <div>
                    <label className="cfg-h3">Swap Free</label>
                    <p className="cfg-hint">Choose options for swap free</p>
                  </div>
                  <div className="cfg-options" role="radiogroup" aria-label="Swap free">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!swapFree}
                      className={`cfg-option ${!swapFree ? 'on' : ''}`}
                      onClick={() => setSwapFree(false)}
                    >
                      <span>No</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={swapFree}
                      className={`cfg-option ${swapFree ? 'on' : ''}`}
                      onClick={() => setSwapFree(true)}
                    >
                      <span className="cfg-option-stacked-inline">
                        <span>Yes</span>
                        <small>MT5 only</small>
                      </span>
                      <span className="cfg-option-price">
                        +{money(selected ? selected.price * 0.1 : 0, currency)}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div id="add-challenge" className="cfg-section cfg-summary-wrap">
                <div className="cfg-summary-card">
                  <h3>{displayName}</h3>
                  <dl>
                    <div>
                      <dt>Model Type</dt>
                      <dd>PropFirm</dd>
                    </div>
                    <div>
                      <dt>Trading Platform</dt>
                      <dd>{platformMeta.label}</dd>
                    </div>
                  </dl>
                </div>

                <div className="cfg-total">
                  <p>Total</p>
                  <div className="cfg-total-price">{money(total, currency)}</div>
                </div>

                <div className="cfg-qty">
                  <span>Quantity</span>
                  <div className="cfg-qty-controls">
                    <button
                      type="button"
                      className="cfg-max"
                      onClick={() => setQty(10)}
                      aria-label="Set quantity to the maximum (10)"
                    >
                      Max <span>|</span> <span>10</span>
                    </button>
                    <div className="cfg-stepper" role="group" aria-label="Quantity">
                      <button
                        type="button"
                        disabled={qty <= 1}
                        aria-label="Decrease quantity"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                      >
                        −
                      </button>
                      <span aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        disabled={qty >= 10}
                        aria-label="Increase quantity"
                        onClick={() => setQty((q) => Math.min(10, q + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {err && <p className="err">{err}</p>}

                <div className="cfg-actions">
                  <button
                    type="button"
                    className="cfg-btn primary"
                    disabled={!selected}
                    onClick={addToBasket}
                  >
                    Add to cart
                  </button>
                  <button
                    type="button"
                    className="cfg-btn ghost"
                    disabled={!selected}
                    onClick={buyNowDirect}
                  >
                    Buy now
                  </button>
                </div>

                <ul className="cfg-benefits" aria-label="Purchase benefits">
                  <li>
                    <strong>Instant access</strong>
                    <span>
                      Get your account and start trading as soon as your purchase is complete.
                    </span>
                  </li>
                  <li>
                    <strong>Rewards paid in seconds</strong>
                    <span>
                      Get your rewards fast, with 90% of payouts processed in seconds.
                    </span>
                  </li>
                  <li>
                    <strong>24/7 human support</strong>
                    <span>
                      Get help from real people whenever you need it, across 195+ countries.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </form>
      </main>

      <BasketDrawer
        open={basketOpen}
        basket={basket}
        currency={currency}
        onClose={() => setBasketOpen(false)}
        onClear={() => setBasket([])}
        onUpdateQty={updateBasketQty}
        onRemove={removeBasketItem}
        onContinue={() => goToBasketCheckout(false)}
      />
    </div>
  );
}
