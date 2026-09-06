'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getSession, saveSession, AuthSession } from '@/lib/api';
import { createCryptoInvoice } from '@/lib/crypto-invoice';

export type BasketLine = {
  key: string;
  productId: string;
  title: string;
  platform: string;
  platformShort: string;
  accountSize: number;
  unitPrice: number;
  swapFree: boolean;
  qty: number;
};

type Props = {
  basket: BasketLine[];
  currency: string;
  money: (n: number, currency: string) => string;
  onBack: () => void;
  onClear: () => void;
  onUpdateQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onPaid: (challengeId?: string) => void;
};

type PayMethod = {
  id: string;
  label: string;
  fee?: string;
};

const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahrain',
  'Bangladesh',
  'Belgium',
  'Brazil',
  'Bulgaria',
  'Canada',
  'Chile',
  'China',
  'Colombia',
  'Croatia',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Egypt',
  'Estonia',
  'Finland',
  'France',
  'Georgia',
  'Germany',
  'Greece',
  'Hong Kong',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kuwait',
  'Latvia',
  'Lebanon',
  'Lithuania',
  'Luxembourg',
  'Malaysia',
  'Malta',
  'Mexico',
  'Morocco',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Oman',
  'Pakistan',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Saudi Arabia',
  'Serbia',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Thailand',
  'Turkey',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
].sort((a, b) => a.localeCompare(b));

const PAY_METHODS: PayMethod[] = [
  { id: 'BASIC_CARD', label: 'Credit / Debit Card' },
  { id: 'CRYPTO', label: 'Crypto' },
  { id: 'APPLEPAY', label: 'Apple Pay' },
  { id: 'GOOGLEPAY', label: 'Google Pay' },
  { id: 'BINANCE_PAY', label: 'Binance Pay' },
  { id: 'PAYPAL', label: 'PayPal' },
  { id: 'NETELLER', label: 'Neteller', fee: '+4%' },
  { id: 'PAYSAFECARD', label: 'Paysafecard', fee: '+10%' },
  { id: 'SKRILL', label: 'Skrill', fee: '+4%' },
];

const MAX_ALLOCATION = 400_000;
const MAX_ACCOUNTS = 10;

function sizeText(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z" />
    </svg>
  );
}

function ChevronsUpDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M181.66,170.34a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-48-48a8,8,0,0,1,11.32-11.32L128,212.69l42.34-42.35A8,8,0,0,1,181.66,170.34Zm-96-84.68L128,43.31l42.34,42.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,85.66Z" />
    </svg>
  );
}

function PayBrand({ id }: { id: string }) {
  if (id === 'BASIC_CARD') {
    return (
      <span className="bc-pay-brands bc-pay-brands-card" aria-hidden="true">
        <svg viewBox="0 0 48 16" className="bc-brand-visa">
          <text x="0" y="13" fill="#1430BF" fontSize="14" fontWeight="700" fontFamily="Arial,sans-serif">
            VISA
          </text>
        </svg>
        <svg viewBox="0 0 32 20" className="bc-brand-mc">
          <circle cx="12" cy="10" r="8" fill="#EB001B" />
          <circle cx="20" cy="10" r="8" fill="#F79E1B" />
          <path d="M16 4.2a8 8 0 0 1 0 11.6 8 8 0 0 1 0-11.6z" fill="#FF5A00" />
        </svg>
      </span>
    );
  }
  if (id === 'CRYPTO') {
    return (
      <svg viewBox="0 0 32 32" className="bc-brand-crypto" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <path
          fill="#FFF"
          d="M21.2 14.1c.2-1.4-.9-2.2-2.3-2.7l.5-1.9-1.2-.3-.5 1.8c-.3-.1-.6-.1-.9-.2l.5-1.8-1.2-.3-.5 1.9c-.2-.1-.5-.1-.7-.2l-1.6-.4-.3 1.2s.9.2.8.2c.5.1.6.4.5.7l-.5 2.2.1 0-.8 3.1c-.1.1-.2.3-.5.3l-.8-.2-.6 1.3 1.5.4c.3.1.6.1.8.2l-.5 1.9 1.2.3.5-1.9c.3.1.6.2.9.2l-.5 1.9 1.2.3.5-1.9c2 .4 3.5.2 4.1-1.6.5-1.4 0-2.3-1.1-2.8.8-.2 1.3-.7 1.5-1.7zm-2.6 3.7c-.4 1.4-2.8.7-3.6.5l.6-2.5c.8.2 3.3.6 3 2zm.4-3.7c-.3 1.3-2.3.6-3 .5l.6-2.3c.6.2 2.7.5 2.4 1.8z"
        />
      </svg>
    );
  }
  if (id === 'APPLEPAY') {
    return (
      <svg viewBox="0 0 52 20" className="bc-brand-word" aria-hidden="true">
        <text x="0" y="15" fill="currentColor" fontSize="13" fontWeight="600" fontFamily="Arial,sans-serif">
          Pay
        </text>
      </svg>
    );
  }
  if (id === 'GOOGLEPAY') {
    return (
      <svg viewBox="0 0 64 20" className="bc-brand-word" aria-hidden="true">
        <text x="0" y="15" fill="currentColor" fontSize="12" fontWeight="600" fontFamily="Arial,sans-serif">
          GPay
        </text>
      </svg>
    );
  }
  if (id === 'BINANCE_PAY') {
    return (
      <svg viewBox="0 0 32 32" className="bc-brand-crypto" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#F0B90B" />
        <path
          fill="#FFF"
          d="M12.1 14.4 16 10.5l3.9 3.9 2.3-2.3L16 6l-6.1 6.1 2.2 2.3ZM6 16l2.3-2.3L10.5 16l-2.2 2.3L6 16zm6.1 1.6L16 21.5l3.9-3.9 2.3 2.3L16 26l-6.1-6.1 2.2-2.3zm9.4-1.6 2.2-2.3L26 16l-2.3 2.3L21.5 16z"
        />
      </svg>
    );
  }
  if (id === 'PAYPAL') {
    return (
      <span className="bc-brand-paypal" aria-hidden="true">
        PayPal
      </span>
    );
  }
  if (id === 'NETELLER') {
    return (
      <span className="bc-brand-neteller" aria-hidden="true">
        Neteller
      </span>
    );
  }
  if (id === 'PAYSAFECARD') {
    return (
      <span className="bc-brand-psc" aria-hidden="true">
        paysafecard
      </span>
    );
  }
  return (
    <span className="bc-brand-skrill" aria-hidden="true">
      Skrill
    </span>
  );
}

function CountryCombobox({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <div className="bc-country" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`bc-country-trigger${value ? ' has-value' : ''}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? '' : 'placeholder'}>{value || 'Select a country'}</span>
        <ChevronsUpDown />
      </button>

      {open && (
        <div className="bc-country-popover" role="presentation">
          <input
            ref={inputRef}
            type="search"
            className="bc-country-search"
            placeholder="Search country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search country"
            autoComplete="off"
          />
          <ul id={`${id}-listbox`} role="listbox" className="bc-country-list" aria-label="Countries">
            {filtered.map((c) => (
              <li key={c} role="option" aria-selected={c === value}>
                <button
                  type="button"
                  className={c === value ? 'on' : ''}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  {c}
                </button>
              </li>
            ))}
            {!filtered.length && <li className="bc-country-empty">No countries found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BasketCheckout({
  basket,
  currency,
  money,
  onBack,
  onClear,
  onUpdateQty,
  onRemove,
  onPaid,
}: Props) {
  const router = useRouter();
  const existing = getSession();
  const [phase, setPhase] = useState<'email' | 'country' | 'ready'>(
    existing ? 'ready' : 'email',
  );
  const [email, setEmail] = useState(existing?.email || '');
  const [country, setCountry] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState('');
  const [billing, setBilling] = useState({
    firstName: '',
    lastName: '',
    street: '',
    city: '',
    postal: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [policiesAccepted, setPoliciesAccepted] = useState(false);

  const count = basket.reduce((n, i) => n + i.qty, 0);
  const total = basket.reduce((n, i) => n + i.unitPrice * i.qty, 0);
  const allocSize = basket.reduce((n, i) => n + i.accountSize * i.qty, 0);
  const allocPct = Math.min(100, (allocSize / MAX_ALLOCATION) * 100);

  const attention = useMemo(() => {
    const items: string[] = [];
    if (phase === 'ready' && !country) items.push('Please set your country');
    if (phase === 'ready' && country && !paymentMethod) {
      items.push('Select a payment method');
    }
    return items;
  }, [phase, country, paymentMethod]);

  function pickCountry(next: string) {
    setCountry(next);
    setPaymentMethod('');
    setPoliciesAccepted(false);
    setErr('');
  }

  async function ensureGuestSession(trimmed: string) {
    if (getSession()) return true;
    try {
      const session = await api<AuthSession>('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          email: trimmed,
          password: 'GuestCheckout1!',
          displayName: trimmed.split('@')[0],
        }),
      });
      saveSession(session);
      return true;
    } catch {
      return false;
    }
  }

  async function onEmailContinue(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setErr('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await ensureGuestSession(trimmed);
      setPhase('country');
    } finally {
      setBusy(false);
    }
  }

  async function onCountryContinue(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!country) {
      setErr('Select your country.');
      return;
    }
    setBusy(true);
    try {
      await ensureGuestSession(email.trim());
      const parts = email.split('@')[0].split(/[._-]/).filter(Boolean);
      setBilling((b) => ({
        ...b,
        firstName: b.firstName || (parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : ''),
        lastName: b.lastName || (parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : ''),
      }));
      setPhase('ready');
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!basket.length) return;
    if (!country) {
      setErr('Please set your country');
      return;
    }
    if (!paymentMethod) {
      setErr('Select a payment method');
      return;
    }
    if (!policiesAccepted) {
      setErr('Please accept the Trading Objectives and Terms & Conditions.');
      return;
    }
    if (!getSession()) {
      setErr('Sign in required to complete payment for this email.');
      return;
    }

    // Crypto → local Confirmo mock (instead of pay.confirmo.com)
    if (paymentMethod === 'CRYPTO') {
      setBusy(true);
      setErr('');
      try {
        const invoice = createCryptoInvoice({
          amountUsd: total,
          currency,
          basket,
          email,
          returnPath:
            typeof window !== 'undefined'
              ? `${window.location.pathname}#basket-checkout`
              : '/',
        });
        router.push(`/pay/confirmo?invoice=${encodeURIComponent(invoice.invoiceId)}`);
      } catch (ex: any) {
        setErr(ex.message || 'Could not start crypto checkout');
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setErr('');
    try {
      let lastChallenge: string | undefined;
      for (const item of basket) {
        const order = await api<{ orderId: string }>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            productId: item.productId,
            addonSwapFree: item.swapFree,
            platform: item.platform,
            quantity: item.qty,
          }),
        });
        const paid = await api<{ challengeId?: string }>(
          `/api/orders/${order.orderId}/confirm`,
          { method: 'POST' },
        );
        lastChallenge = paid.challengeId || lastChallenge;
      }
      onPaid(lastChallenge);
    } catch (ex: any) {
      setErr(ex.message || 'payment failed');
    } finally {
      setBusy(false);
    }
  }

  const signInHref = `/login?next=${encodeURIComponent(
    typeof window !== 'undefined' ? window.location.pathname + '#basket-checkout' : '/checkout',
  )}`;

  const canContinuePayment =
    !!country && !!paymentMethod && policiesAccepted && basket.length > 0 && !busy;

  function renderPayPanel(methodId: string) {
    if (paymentMethod !== methodId) return null;
    return (
      <div className="bc-pay-expand">
        <div className="bc-pay-expand-inner">
          <div className="bc-policy">
            <button
              type="button"
              role="checkbox"
              aria-checked={policiesAccepted}
              id={`cart-policies-${methodId}`}
              className={`bc-checkbox${policiesAccepted ? ' on' : ''}`}
              onClick={() => setPoliciesAccepted((v) => !v)}
            >
              {policiesAccepted ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                  <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                </svg>
              ) : null}
            </button>
            <label htmlFor={`cart-policies-${methodId}`} className="bc-policy-label">
              I have read and agreed to the{' '}
              <a href="https://fundingpips.com/trading-objectives" target="_blank" rel="noopener noreferrer">
                Trading Objectives
              </a>{' '}
              and{' '}
              <a href="https://fundingpips.com/legal/terms-and-conditions" target="_blank" rel="noopener noreferrer">
                Terms &amp; Conditions
              </a>
              . All information provided is correct and matches government-issued ID.
            </label>
          </div>

          {err && <p className="err">{err}</p>}

          <button
            type="button"
            className="bc-pay-continue"
            disabled={!canContinuePayment}
            onClick={pay}
          >
            {busy ? 'Processing…' : 'Continue to payment'}
          </button>

          <p className="bc-secure-checkout">
            <span>
              <ShieldCheckIcon />
              <span>Secure checkout</span>
            </span>
            <span className="bc-secure-sub">Your basket is kept if payment does not complete.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <section id="basket-checkout" className="bc-page">
      <header className="bc-head">
        <button type="button" className="bc-back" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
            <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
          </svg>
          Add another challenge
        </button>
        <h1 id="cart-checkout-heading" tabIndex={-1}>
          Checkout
        </h1>
        <p>
          {count} challenge{count === 1 ? '' : 's'}
        </p>
      </header>

      <div className="bc-grid">
        <div className="bc-main">
          <section aria-label="Checkout identity" className="bc-identity">
            {phase !== 'ready' ? (
              <section className="bc-identity-panel">
                <header>
                  <h2>Continue as guest</h2>
                  <p>
                    {phase === 'email'
                      ? 'Enter your email to continue with this basket.'
                      : 'Select your country to continue.'}
                  </p>
                </header>

                <div className="bc-identity-panel-body">
                  {phase === 'email' ? (
                    <form className="bc-guest-form" onSubmit={onEmailContinue} noValidate>
                      <div className="bc-field">
                        <label htmlFor="guest-checkout-email">Email address</label>
                        <input
                          id="guest-checkout-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-invalid={!!err}
                        />
                      </div>
                      {err && <p className="err">{err}</p>}
                      <button type="submit" className="bc-continue" disabled={busy}>
                        {busy ? 'Please wait…' : 'Continue'}
                      </button>
                    </form>
                  ) : (
                    <form className="bc-guest-form" onSubmit={onCountryContinue} noValidate>
                      <div className="bc-field">
                        <label htmlFor="guest-checkout-email-ro">Email address</label>
                        <input id="guest-checkout-email-ro" type="email" value={email} readOnly />
                      </div>
                      <div className="bc-field">
                        <label htmlFor="guest-checkout-country">Country</label>
                        <CountryCombobox
                          id="guest-checkout-country"
                          value={country}
                          onChange={pickCountry}
                          invalid={!!err && !country}
                        />
                      </div>
                      {err && <p className="err">{err}</p>}
                      <button type="submit" className="bc-continue" disabled={busy}>
                        {busy ? 'Please wait…' : 'Continue'}
                      </button>
                    </form>
                  )}
                </div>

                <footer>
                  <div className="bc-identity-footer">
                    <div className="bc-secure">
                      <LockIcon />
                      Your basket is protected by an encrypted browser session.
                    </div>
                    <p className="bc-signin">
                      Already have an account?{' '}
                      <Link href={signInHref}>Sign in</Link>
                    </p>
                  </div>
                </footer>
              </section>
            ) : (
              <div className="bc-contact-summary">
                <div>
                  <h2>Contact</h2>
                  <p>{email}</p>
                </div>
                <p className="bc-signed-in">Signed in</p>
              </div>
            )}
          </section>

          <section aria-labelledby="cart-items-heading">
            <div className="bc-items-head">
              <h2 id="cart-items-heading">Basket items</h2>
              <button type="button" className="bc-clear" onClick={onClear} disabled={!basket.length}>
                Clear basket
              </button>
            </div>
            <div className="bc-items">
              {basket.map((item) => (
                <article key={item.key} className="bc-item">
                  <div className="bc-item-row">
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        {item.platformShort}
                        {item.swapFree ? ' · Swap Free' : ''}
                      </p>
                    </div>
                    <div className="bc-item-controls">
                      <div className="cfg-qty-controls">
                        <button
                          type="button"
                          className="cfg-max"
                          onClick={() => onUpdateQty(item.key, 10)}
                        >
                          Max <span>|</span> <span>10</span>
                        </button>
                        <div className="cfg-stepper" role="group">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => onUpdateQty(item.key, item.qty - 1)}
                          >
                            −
                          </button>
                          <span>{item.qty}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={item.qty >= 10}
                            onClick={() => onUpdateQty(item.key, item.qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <strong>{money(item.unitPrice * item.qty, currency)}</strong>
                      <button
                        type="button"
                        className="cfg-remove-item"
                        aria-label={`Remove ${item.title}`}
                        onClick={() => onRemove(item.key)}
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!basket.length && <p className="cfg-drawer-empty">Your basket is empty.</p>}
            </div>
          </section>

          {phase === 'ready' && (
            <section aria-labelledby="billing-details-heading" className="bc-billing" id="billing-details">
              <h2 className="sr-only" id="billing-details-heading">
                Billing Details
              </h2>
              <div className="bc-billing-head">
                <div>
                  <p className="bc-billing-title">Billing Details</p>
                  <p className="bc-billing-sub">
                    Enter your billing information for the challenge purchase
                  </p>
                </div>
              </div>

              <div className="bc-billing-form">
                <div className="bc-billing-grid2">
                  <div className="bc-field">
                    <label htmlFor="billing.first_name">First Name</label>
                    <input
                      id="billing.first_name"
                      value={billing.firstName}
                      onChange={(e) => setBilling({ ...billing, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="bc-field">
                    <label htmlFor="billing.last_name">Last Name</label>
                    <input
                      id="billing.last_name"
                      value={billing.lastName}
                      onChange={(e) => setBilling({ ...billing, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="bc-field">
                  <label htmlFor="billing.country">Country</label>
                  <CountryCombobox id="billing.country" value={country} onChange={pickCountry} />
                </div>

                <div className="bc-field">
                  <label htmlFor="billing.street">Billing Address</label>
                  <input
                    id="billing.street"
                    value={billing.street}
                    onChange={(e) => setBilling({ ...billing, street: e.target.value })}
                    placeholder="123, Billing Street"
                  />
                </div>

                <div className="bc-billing-grid2">
                  <div className="bc-field">
                    <label htmlFor="billing.city">City</label>
                    <input
                      id="billing.city"
                      value={billing.city}
                      onChange={(e) => setBilling({ ...billing, city: e.target.value })}
                      placeholder="New York"
                    />
                  </div>
                  <div className="bc-field">
                    <label htmlFor="billing.postal_code">ZIP / Postal Code</label>
                    <input
                      id="billing.postal_code"
                      value={billing.postal}
                      onChange={(e) => setBilling({ ...billing, postal: e.target.value })}
                      placeholder="10001"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="bc-aside">
          <div className="bc-summary-card">
            <section aria-labelledby="cart-summary-heading" className="bc-summary">
              <h2 id="cart-summary-heading">Order summary</h2>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(total, currency)}</dd>
                </div>
              </dl>
              <div className="bc-summary-total">
                <span>Total</span>
                <strong>{money(total, currency)}</strong>
              </div>
              <p className="bc-charge">You will be charged in {currency}.</p>

              {phase === 'ready' && attention.length > 0 && (
                <div className="bc-alert" role="alert">
                  <div className="bc-alert-inner">
                    <span className="bc-alert-icon" aria-hidden="true">
                      <LockIcon />
                    </span>
                    <div>
                      <h3>Some items need attention</h3>
                      <ul>
                        {attention.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {phase === 'ready' && (
                <section className="bc-alloc-inline" aria-label="Account allocation">
                  <div className="cfg-alloc-row">
                    <span>Allocation after checkout</span>
                    <span>
                      {sizeText(allocSize)} of {sizeText(MAX_ALLOCATION)}
                    </span>
                  </div>
                  <div className="cfg-alloc-bar" role="progressbar" aria-valuenow={allocSize}>
                    <div style={{ width: `${allocPct}%` }} />
                  </div>
                  <p className="cfg-alloc-hint">
                    {sizeText(Math.max(0, MAX_ALLOCATION - allocSize))} remaining
                  </p>
                  <div className="cfg-alloc-accounts">
                    <div className="cfg-alloc-row">
                      <span>Accounts after checkout</span>
                      <span>
                        {count} of {MAX_ACCOUNTS}
                      </span>
                    </div>
                    <p className="cfg-alloc-hint">
                      {Math.max(0, MAX_ACCOUNTS - count)} account slots remaining
                    </p>
                  </div>
                </section>
              )}
            </section>

            {phase === 'ready' && (
              <>
                <section className="bc-coupon" aria-label="Coupon">
                  <label htmlFor="cart-coupon">Coupon code</label>
                  <div className="bc-coupon-row">
                    <input
                      id="cart-coupon"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                      autoComplete="off"
                    />
                    <button type="button" disabled={!coupon.trim()}>
                      Apply
                    </button>
                  </div>
                </section>

                <section className="bc-pay-methods" aria-label="Payment methods">
                  <label className="bc-pay-label">Select payment method</label>
                  {!country ? (
                    <p className="bc-pay-empty" role="status">
                      Select your billing country to see available payment methods.
                    </p>
                  ) : (
                    <div className="bc-pay-list" role="radiogroup" aria-label="Payment methods">
                      {PAY_METHODS.map((m) => (
                        <div key={m.id} className="bc-pay-block">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={paymentMethod === m.id}
                            aria-label={m.label}
                            className={`bc-pay-row${paymentMethod === m.id ? ' on' : ''}`}
                            onClick={() => {
                              setPaymentMethod(m.id);
                              setErr('');
                            }}
                          >
                            <span className={`bc-pay-radio${paymentMethod === m.id ? ' on' : ''}`}>
                              {paymentMethod === m.id ? <span /> : null}
                            </span>
                            <span className="bc-pay-copy">
                              <span className="bc-pay-name">{m.label}</span>
                              {m.fee ? <span className="bc-pay-fee">{m.fee}</span> : null}
                            </span>
                            <PayBrand id={m.id} />
                          </button>
                          {renderPayPanel(m.id)}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
