'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { BasketLine } from '@/components/BasketCheckout';
import { basketCount, basketTotal } from '@/lib/basket';

const MAX_ALLOCATION = 400_000;
const MAX_ACCOUNTS = 10;

function sizeText(n: number) {
  return n >= 1000 ? `$${n / 1000}k` : `$${n}`;
}

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

type Props = {
  open: boolean;
  basket: BasketLine[];
  currency?: string;
  onClose: () => void;
  onClear: () => void;
  onUpdateQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  /** When set, Continue stays on current checkout flow. Otherwise navigates to checkout. */
  onContinue?: () => void;
};

export function BasketDrawer({
  open,
  basket,
  currency = 'USD',
  onClose,
  onClear,
  onUpdateQty,
  onRemove,
  onContinue,
}: Props) {
  const router = useRouter();
  const count = basketCount(basket);
  const total = basketTotal(basket);
  const allocSize = basket.reduce((n, i) => n + i.accountSize * i.qty, 0);
  const allocPct = Math.min(100, (allocSize / MAX_ALLOCATION) * 100);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function continueCheckout() {
    if (onContinue) {
      onContinue();
      return;
    }
    const first = basket[0];
    if (!first) {
      router.push('/');
      onClose();
      return;
    }
    onClose();
    router.push(`/checkout/${first.productId}#basket-checkout`);
  }

  return (
    <div className="cfg-drawer-root" role="presentation">
      <button type="button" className="cfg-drawer-backdrop" aria-label="Close basket" onClick={onClose} />
      <aside className="cfg-drawer" role="dialog" aria-modal="true" aria-labelledby="basket-title">
        <header className="cfg-drawer-head">
          <h2 id="basket-title">Your basket</h2>
          <button type="button" className="cfg-drawer-close" aria-label="Close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
            </svg>
          </button>
        </header>

        <div className="cfg-drawer-body">
          <div className="cfg-drawer-count-row">
            <p>
              {count} challenge{count === 1 ? '' : 's'}
            </p>
            <button type="button" className="cfg-clear-basket" disabled={!basket.length} onClick={onClear}>
              Clear basket
            </button>
          </div>

          <section className="cfg-alloc" aria-label="Account allocation">
            <div className="cfg-alloc-row">
              <span>Allocation after checkout</span>
              <span>
                {sizeText(allocSize)} of {sizeText(MAX_ALLOCATION)}
              </span>
            </div>
            <div
              className="cfg-alloc-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={MAX_ALLOCATION}
              aria-valuenow={allocSize}
              aria-label="Allocation after checkout"
            >
              <div style={{ width: `${allocPct}%` }} />
            </div>
            <p className="cfg-alloc-hint">{sizeText(Math.max(0, MAX_ALLOCATION - allocSize))} remaining</p>
            <div className="cfg-alloc-accounts">
              <div className="cfg-alloc-row">
                <span>Accounts after checkout</span>
                <span>
                  {count} of {MAX_ACCOUNTS}
                </span>
              </div>
              <p className="cfg-alloc-hint">{Math.max(0, MAX_ACCOUNTS - count)} account slots remaining</p>
            </div>
          </section>

          <div className="cfg-drawer-items">
            {basket.length === 0 ? (
              <p className="cfg-drawer-empty">Your basket is empty.</p>
            ) : (
              basket.map((item) => (
                <article key={item.key} className="cfg-cart-item">
                  <div className="cfg-cart-top">
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        {item.platformShort}
                        {item.swapFree ? ' · Swap Free' : ''}
                      </p>
                    </div>
                    <div className="cfg-cart-price">
                      <span>Challenge total</span>
                      <strong>{money(item.unitPrice * item.qty, currency)}</strong>
                    </div>
                  </div>
                  <div className="cfg-cart-qty">
                    <span>Quantity</span>
                    <div className="cfg-qty-controls">
                      <button type="button" className="cfg-max" onClick={() => onUpdateQty(item.key, 10)}>
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
                      <button
                        type="button"
                        className="cfg-remove-item"
                        aria-label={`Remove ${item.title} from basket`}
                        onClick={() => onRemove(item.key)}
                      >
                        ⌫
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <footer className="cfg-drawer-foot">
          <div className="cfg-drawer-total">
            <span>Total</span>
            <strong>{money(total, currency)}</strong>
          </div>
          <p className="cfg-drawer-charge">You will be charged in {currency}.</p>
          {basket.length ? (
            <button type="button" className="cfg-btn primary" onClick={continueCheckout}>
              Continue to checkout
            </button>
          ) : (
            <button
              type="button"
              className="cfg-btn primary"
              onClick={() => {
                onClose();
                router.push('/');
              }}
            >
              Start a challenge
            </button>
          )}
          <button
            type="button"
            className="cfg-add-another"
            onClick={() => {
              onClose();
              router.push('/');
            }}
          >
            Add another challenge
          </button>
        </footer>
      </aside>
    </div>
  );
}
