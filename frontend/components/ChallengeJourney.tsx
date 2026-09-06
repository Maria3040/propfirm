'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

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

const PHASES = [
  { id: 'zero', label: 'Zero' },
  { id: 'one_step_flex', label: '1 Step Flex', badge: 'New' },
  { id: 'two_step', label: '2 Step' },
] as const;

const VARIANTS = [
  { id: 'standard', label: 'Standard', hint: 'Highest Profit Split' },
  { id: 'flex', label: 'Flex', hint: 'Biggest Max Loss' },
  { id: 'pro', label: 'Pro', hint: 'Lowest Profit Target' },
] as const;

function sizeLabel(n: number) {
  return n >= 1000 ? `$${n / 1000}K` : `$${n}`;
}

export function ChallengeJourney() {
  const [phase, setPhase] = useState<string>('two_step');
  const [variant, setVariant] = useState<string>('flex');
  const [currency, setCurrency] = useState('USD');
  const [swapFree, setSwapFree] = useState(false);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    const q = new URLSearchParams({ phaseFamily: phase });
    if (phase === 'two_step') q.set('variant', variant);
    api<CatalogProduct[]>(`/api/catalog/products?${q}`, { auth: false })
      .then(setProducts)
      .catch((e) => setErr(String(e.message || e)));
  }, [phase, variant]);

  const showVariant = phase === 'two_step';
  const homeProducts = products.filter((p) => p.accountSize <= 100000);

  return (
    <section className="journey">
      <div className="journey-head">
        <h2>Buckle Up, Your Journey Starts Here!</h2>
        <p>1 Step, 2 Step, or Zero. Multiple routes to match your trading style and budget.</p>
      </div>

      {err && <p className="err">{err}</p>}

      <div className="journey-toolbar desktop-only">
        <div className="pill-group">
          <span className="flag">{FX[currency].flag}</span>
          <select
            aria-label="Select currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {Object.keys(FX).map((c) => (
              <option key={c} value={c}>
                {FX[c].symbol}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-center">
          <div className="seg" role="radiogroup" aria-label="Select challenge phase">
            {PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={phase === p.id}
                className={phase === p.id ? 'on' : ''}
                onClick={() => setPhase(p.id)}
              >
                {p.label}
                {'badge' in p && p.badge ? <span className="new-badge">{p.badge}</span> : null}
              </button>
            ))}
          </div>
          {showVariant && (
            <div className="seg seg-sm" role="radiogroup" aria-label="Select challenge variant">
              {VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={variant === v.id}
                  className={variant === v.id ? 'on' : ''}
                  onClick={() => setVariant(v.id)}
                >
                  <span>{v.label}</span>
                  <small>{v.hint}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* spacer mirrors currency pill so the phase/variant segs stay centered */}
        <div className="pill-group spacer" aria-hidden="true" />
      </div>

      {/* Mobile: phase / variant only — all 5 size cards stay in one scrollable row below */}
      <div className="journey-mobile mobile-only">
        <div className="seg" role="radiogroup">
          {PHASES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={phase === p.id ? 'on' : ''}
              onClick={() => setPhase(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {showVariant && (
          <div className="seg seg-sm" role="radiogroup">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={variant === v.id ? 'on' : ''}
                onClick={() => setVariant(v.id)}
              >
                <span>{v.label}</span>
                <small>{v.hint}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="addon">
        <input
          type="checkbox"
          checked={swapFree}
          onChange={(e) => setSwapFree(e.target.checked)}
        />
        Add-on: <strong>Swap Free (+10%)</strong>
      </label>

      {/* Always one row of size cards (5K–100K) */}
      <div className="journey-grid-wrap">
        <div className="journey-grid">
          {homeProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={currency}
              swapFree={swapFree}
              featured={p.isMostPopular}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function InfoTip({ label }: { label: string }) {
  return (
    <button type="button" className="info-tip" aria-label={label} title={label}>
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
        <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
      </svg>
    </button>
  );
}

const STANDARD_CYCLES = [
  { cycle: 'Biweekly', split: 80 },
  { cycle: 'Weekly', split: 75 },
  { cycle: 'Monthly', split: 85 },
] as const;

function daysLabel(n: number) {
  if (n <= 0) return '—';
  if (n === 1) return '1 day';
  return `${n} days`;
}

function ProductCard({
  product,
  currency,
  swapFree,
  featured,
}: {
  product: CatalogProduct;
  currency: string;
  swapFree: boolean;
  featured?: boolean;
}) {
  const fx = FX[currency];
  const [cycleIdx, setCycleIdx] = useState(0);
  const price = Math.round(product.price * (swapFree ? 1.1 : 1) * fx.rate);
  const compare =
    product.comparePrice != null
      ? Math.round(product.comparePrice * (swapFree ? 1.1 : 1) * fx.rate)
      : null;
  const avg = Math.round(product.avgFirstReward * fx.rate);
  const href = `/checkout/${product.id}${swapFree ? '?addon=swapFree' : ''}`;
  const sizeText = sizeLabel(product.accountSize);
  const canCycleSplit = product.variant === 'standard';
  const cycle = STANDARD_CYCLES[cycleIdx % STANDARD_CYCLES.length];

  const splitTip =
    product.variant === 'standard' || product.variant === 'pro'
      ? 'Split: Your reward split for the selected reward cycle.'
      : 'Split: 85% reward split is the default. 95% is available as an add-on';

  return (
    <article className={`pf-card ${featured ? 'featured' : ''}`}>
      <div className="pf-card-badge-slot">
        {featured ? <p className="popular">Most popular</p> : null}
      </div>

      <div className="pf-card-body">
        <div className="pf-mobile-price">
          <div className="pf-mobile-price-line">
            <p className="pf-display-price">
              {fx.symbol}
              {price.toLocaleString()}
            </p>
            {compare != null && (
              <del>
                {fx.symbol}
                {compare.toLocaleString()}
              </del>
            )}
          </div>
          <p className="for-size">for {sizeText} Account</p>
          <p className="addon-hint">
            Add-on available: <span>Swap Free (+10%)</span>
          </p>
        </div>

        <div className="pf-price-row">
          <span className="label">Account size</span>
          <span className="label end">Price</span>
          <span className="size">{sizeText}</span>
          <span className="price-line">
            {compare != null && (
              <del>
                {fx.symbol}
                {compare.toLocaleString()}
              </del>
            )}
            <span className="price-now">
              <span className="sym">{fx.symbol}</span>
              {price.toLocaleString()}
            </span>
          </span>
        </div>

        <Link className="buy" href={href}>
          <span>Buy Challenge</span>
        </Link>
      </div>

      <div className="rules">
        <div className="rule-block">
          <div className="rule-title">
            Profit Target
            <InfoTip label="Profit Target: Reach the profit target while respecting the risk limits. There is no time pressure, so you can trade at your own pace." />
          </div>
          <div className="rule-row">
            <span>Phase 1</span>
            <strong>{product.phase1TargetPct ? `${product.phase1TargetPct}%` : '—'}</strong>
          </div>
          <div className="rule-row">
            <span>Phase 2</span>
            <strong>{product.phase2TargetPct ? `${product.phase2TargetPct}%` : '—'}</strong>
          </div>
          <div className="rule-row">
            <span>Master</span>
            <strong>—</strong>
          </div>
        </div>

        <div className="rule-row single">
          <span className="rule-title">
            Max Loss
            <InfoTip label="Max Loss: The amount you are allowed to lose overall" />
          </span>
          <strong>{product.maxLossPct}%</strong>
        </div>

        <div className="rule-row single">
          <span className="rule-title">
            Daily Loss
            <InfoTip label="Daily Loss: The amount you are allowed to lose every day." />
          </span>
          <strong>{product.dailyLossPct}%</strong>
        </div>

        <div className="rule-block">
          <div className="rule-title">
            Min Trading Days
            <InfoTip label="Min Trading Days: The minimum number of trading days required before completing the evaluation." />
          </div>
          <div className="rule-row">
            <span>Evaluation Stage</span>
            <strong>{daysLabel(product.minTradingDays)}</strong>
          </div>
        </div>

        <div className="rule-row single">
          <span className="rule-title">
            Split
            <InfoTip label={splitTip} />
          </span>
          {canCycleSplit ? (
            <button
              type="button"
              className="split-cycle"
              aria-label="Change reward cycle"
              onClick={() => setCycleIdx((i) => (i + 1) % STANDARD_CYCLES.length)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M168.49,199.51a12,12,0,0,1-17,17l-80-80a12,12,0,0,1,0-17l80-80a12,12,0,0,1,17,17L97,128Z" />
              </svg>
              <span>
                {cycle.cycle} · {cycle.split}%
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z" />
              </svg>
            </button>
          ) : product.variant === 'pro' ? (
            <strong className="split-val">
              {product.rewardCycle} · {product.profitSplitPct}%
            </strong>
          ) : (
            <strong className="split-val">
              {product.rewardCycle} Up to {product.profitSplitPct}%
            </strong>
          )}
        </div>
      </div>

      <p className="avg">
        Traders earn{' '}
        <strong>
          {fx.symbol}
          {avg.toLocaleString()}
        </strong>{' '}
        avg first rewards
      </p>
    </article>
  );
}
