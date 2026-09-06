'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  clearCryptoInvoice,
  loadCryptoInvoice,
  type CryptoInvoice,
} from '@/lib/crypto-invoice';
import { writeBasket } from '@/lib/basket';

type Token = {
  id: string;
  title: string;
  color: string;
  networks: { id: string; label: string }[];
};

const TOKENS: Token[] = [
  {
    id: 'usdc',
    title: 'USDC',
    color: '#2775CA',
    networks: [
      { id: 'ethereum', label: 'Ethereum' },
      { id: 'solana', label: 'Solana' },
    ],
  },
  {
    id: 'usdt',
    title: 'USDT',
    color: '#26A17B',
    networks: [
      { id: 'ethereum', label: 'Ethereum' },
      { id: 'tron', label: 'Tron' },
      { id: 'solana', label: 'Solana' },
    ],
  },
  {
    id: 'usdg',
    title: 'USDG',
    color: '#1B6BFF',
    networks: [
      { id: 'ethereum', label: 'Ethereum' },
      { id: 'solana', label: 'Solana' },
    ],
  },
  {
    id: 'btc',
    title: 'Bitcoin',
    color: '#F7931A',
    networks: [
      { id: 'bitcoin', label: 'Bitcoin' },
      { id: 'lightning', label: 'Lightning' },
    ],
  },
  {
    id: 'eth',
    title: 'Ethereum',
    color: '#627EEA',
    networks: [{ id: 'ethereum', label: 'Ethereum' }],
  },
  {
    id: 'sol',
    title: 'Solana',
    color: '#9945FF',
    networks: [{ id: 'solana', label: 'Solana' }],
  },
  {
    id: 'ltc',
    title: 'Litecoin',
    color: '#345D9D',
    networks: [{ id: 'litecoin', label: 'Litecoin' }],
  },
];

function mockAddress(tokenId: string, networkId: string) {
  if (networkId === 'bitcoin' || tokenId === 'btc') {
    return 'bc1qpropfirmmockpaymentaddress000000xyz';
  }
  if (networkId === 'tron') return 'TPropFirmMockTronAddress0000000001';
  if (networkId === 'solana' || tokenId === 'sol') {
    return 'SoLPropFirmMock1111111111111111111111111';
  }
  return '0xPropFirmMockEthereumAddress000000000001';
}

function TokenIcon({ color, label }: { color: string; label: string }) {
  return (
    <div className="cfm-token-icon" style={{ background: color }} aria-hidden="true">
      {label.slice(0, 1)}
    </div>
  );
}

export function ConfirmoPayMock() {
  const router = useRouter();
  const search = useSearchParams();
  const [invoice, setInvoice] = useState<CryptoInvoice | null>(null);
  const [tab, setTab] = useState<'token' | 'network'>('token');
  const [tokenId, setTokenId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [step, setStep] = useState<'select' | 'pay' | 'done'>('select');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = loadCryptoInvoice();
    const q = search.get('invoice');
    if (stored && (!q || q === stored.invoiceId)) {
      setInvoice(stored);
      return;
    }
    setInvoice(null);
  }, [search]);

  const token = TOKENS.find((t) => t.id === tokenId) || null;
  const network = token?.networks.find((n) => n.id === networkId) || null;
  const progress = step === 'done' ? 4 : step === 'pay' ? 3 : tokenId && networkId ? 2 : tokenId ? 2 : 1;

  const amountLabel = useMemo(() => {
    if (!invoice) return '—';
    return `${invoice.amountUsd.toFixed(2)} ${invoice.currency}`;
  }, [invoice]);

  const address = token && network ? mockAddress(token.id, network.id) : '';

  function onReturn() {
    if (step === 'pay') {
      setStep('select');
      return;
    }
    if (tab === 'network' && tokenId) {
      setTab('token');
      return;
    }
    const back = invoice?.returnPath || '/';
    router.push(back);
  }

  function selectToken(id: string) {
    setTokenId(id);
    setNetworkId('');
    setTab('network');
  }

  function selectNetwork(id: string) {
    setNetworkId(id);
  }

  async function continueToPay() {
    if (!token || !network) return;
    setStep('pay');
  }

  async function simulatePaid() {
    if (!invoice) return;
    setBusy(true);
    setErr('');
    try {
      let lastChallenge: string | undefined;
      for (const item of invoice.basket) {
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
      clearCryptoInvoice();
      writeBasket([]);
      setStep('done');
      setTimeout(() => {
        router.push('/accounts');
      }, 1200);
    } catch (ex: any) {
      setErr(ex.message || 'Payment confirmation failed');
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  if (!invoice) {
    return (
      <div className="cfm-root">
        <div className="cfm-card">
          <main className="cfm-main">
            <h1 className="cfm-heading">Invoice not found</h1>
            <p className="cfm-sub">This mock Confirmo invoice expired or was never created.</p>
            <button type="button" className="cfm-primary" onClick={() => router.push('/')}>
              Back to catalog
            </button>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="cfm-root">
      <div className="cfm-card">
        <header className="cfm-nav">
          <button type="button" className="cfm-return" onClick={onReturn}>
            ← Return
          </button>
          <div
            className="cfm-pills"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={4}
            aria-valuenow={progress}
            aria-label="Checkout progress"
          >
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`cfm-pill${n <= progress ? ' active' : ' pending'}`} />
            ))}
          </div>
          <button
            type="button"
            className="cfm-overlay-btn"
            aria-label="Open overlay"
            onClick={() => setOverlayOpen(true)}
          >
            <span className="cfm-lang">🌐 en</span>
            <span aria-hidden="true">?</span>
          </button>
        </header>

        <main className="cfm-main">
          {step === 'select' && (
            <>
              <div className="cfm-heading-block">
                <h1 className="cfm-heading">{tab === 'token' ? 'Select token' : 'Select network'}</h1>
                <p className="cfm-sub">
                  {tab === 'token'
                    ? 'Payment selection requires two steps. A crypto token and a network to carry it. You must send the token on the network you select.'
                    : `Choose the network for ${token?.title || 'your token'}. Sending on the wrong network may result in loss of funds.`}
                </p>
              </div>

              <div className="cfm-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`cfm-tab${tab === 'token' ? ' active' : ''}`}
                  aria-selected={tab === 'token'}
                  onClick={() => setTab('token')}
                >
                  Token
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`cfm-tab${tab === 'network' ? ' active' : ''}`}
                  aria-selected={tab === 'network'}
                  disabled={!tokenId}
                  onClick={() => tokenId && setTab('network')}
                >
                  Network
                </button>
              </div>

              {tab === 'token' ? (
                <ul className="cfm-list">
                  {TOKENS.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className={`cfm-list-btn${tokenId === t.id ? ' on' : ''}`}
                        onClick={() => selectToken(t.id)}
                      >
                        <TokenIcon color={t.color} label={t.title} />
                        <span className="cfm-list-text">
                          <span className="cfm-list-title">{t.title}</span>
                          <span className="cfm-list-sub">
                            {t.networks.length} network{t.networks.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="cfm-list">
                  {(token?.networks || []).map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`cfm-list-btn${networkId === n.id ? ' on' : ''}`}
                        onClick={() => selectNetwork(n.id)}
                      >
                        <TokenIcon color={token?.color || '#888'} label={n.label} />
                        <span className="cfm-list-text">
                          <span className="cfm-list-title">{n.label}</span>
                          <span className="cfm-list-sub">{token?.title}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {step === 'pay' && token && network && (
            <div className="cfm-pay">
              <div className="cfm-heading-block">
                <h1 className="cfm-heading">Send payment</h1>
                <p className="cfm-sub">
                  Send exactly the amount below using {token.title} on {network.label}. This is a local mock —
                  no real blockchain transfer is required.
                </p>
              </div>

              <div className="cfm-pay-card">
                <div className="cfm-pay-row">
                  <span>Amount</span>
                  <strong>
                    {invoice.amountUsd.toFixed(2)} {token.title}
                  </strong>
                </div>
                <div className="cfm-pay-row">
                  <span>Network</span>
                  <strong>{network.label}</strong>
                </div>
                <div className="cfm-address">
                  <span>Deposit address</span>
                  <code>{address}</code>
                  <button type="button" onClick={copyAddress}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="cfm-qr" aria-hidden="true">
                  <div className="cfm-qr-inner" />
                </div>
              </div>

              {err && <p className="err">{err}</p>}

              <button type="button" className="cfm-primary" disabled={busy} onClick={simulatePaid}>
                {busy ? 'Confirming…' : 'Simulate payment received'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="cfm-done">
              <div className="cfm-done-icon" aria-hidden="true">
                ✓
              </div>
              <h1 className="cfm-heading">Payment confirmed</h1>
              <p className="cfm-sub">Redirecting to your challenge…</p>
            </div>
          )}
        </main>

        {step === 'select' && (
          <footer className="cfm-dock">
            <div className="cfm-price-row">
              <span>Product price</span>
              <span>{amountLabel}</span>
            </div>
            <button
              type="button"
              className="cfm-dock-btn"
              disabled={!token || !network}
              onClick={continueToPay}
            >
              <span className="cfm-dock-icons">
                {token ? (
                  <TokenIcon color={token.color} label={token.title} />
                ) : (
                  <span className="cfm-dock-placeholder-icon" />
                )}
                {network ? (
                  <TokenIcon color="#222" label={network.label} />
                ) : (
                  <span className="cfm-dock-placeholder-icon" />
                )}
              </span>
              <span className="cfm-dock-label">
                {token && network
                  ? `Continue with ${token.title}`
                  : token
                    ? 'Select network'
                    : 'Select token'}
              </span>
            </button>
            <p className="cfm-cookies">
              By using this service, you agree to our{' '}
              <a href="https://confirmo.com/legal-and-regulatory" target="_blank" rel="noopener noreferrer">
                Cookie Policy
              </a>
              . <span className="cfm-mock-tag">Mock gateway</span>
            </p>
          </footer>
        )}
      </div>

      {overlayOpen && (
        <div className="cfm-support" role="dialog" aria-modal="true" aria-label="Support">
          <div className="cfm-support-inner">
            <header>
              <button type="button" className="cfm-return" onClick={() => setOverlayOpen(false)}>
                Close ×
              </button>
            </header>
            <section className="cfm-support-list">
              <div className="cfm-support-item">
                <span>Language</span>
                <strong>English</strong>
              </div>
              <div className="cfm-support-item">
                <span>Payment ID</span>
                <strong title={invoice.invoiceId}>{invoice.invoiceId}</strong>
              </div>
              <div className="cfm-support-item">
                <span>Support</span>
                <strong>support@confirmo.com</strong>
              </div>
            </section>
            <footer>
              <p>
                Mock of{' '}
                <a href="https://confirmo.com" target="_blank" rel="noopener noreferrer">
                  confirmo.com
                </a>
              </p>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
