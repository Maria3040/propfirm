'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { accountNo, moneyPlain, sizeLabel, typeLabel } from '@/lib/accounts-format';
import {
  CRYPTO_WALLET_NETWORKS,
  loadSavedCryptoWallets,
  saveCryptoWallets,
  toPayoutNetwork,
  type SavedCryptoWallet,
} from '@/lib/crypto-wallets';

type EligibleAccount = {
  id: string;
  sku: string;
  status: string;
  accountSize: number;
  equity: number;
  login: string | null;
  platform: string | null;
  profitSplitPct?: number;
  grossProfit?: number;
  profitShareCap?: number;
  alreadyRequested?: number;
  profitShareAvailable?: number;
  withdrawable?: number;
};

type EligibleResponse = {
  availableBalance: number;
  accounts: EligibleAccount[];
};

const METHODS = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'rise', label: 'Rise' },
  { id: 'bank', label: 'Bank transfer' },
] as const;

function CalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,16V88H32V64Zm0,128H32V104H224v88Zm-16-24a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h32A8,8,0,0,1,208,168Zm-64,0a8,8,0,0,1-8,8H120a8,8,0,0,1,0-16h16A8,8,0,0,1,144,168Z" />
    </svg>
  );
}

function accountWithdrawable(a: EligibleAccount, _walletBal: number): number {
  if (typeof a.withdrawable === 'number') return a.withdrawable;
  if (typeof a.profitShareAvailable === 'number') return a.profitShareAvailable;
  return Math.max(0, Number(a.grossProfit || 0));
}

export default function RequestRewardPage() {
  const router = useRouter();
  const { ready, authenticated } = useRequireAuth('/payouts/request');
  const [data, setData] = useState<EligibleResponse | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('crypto');
  const [wallets, setWallets] = useState<SavedCryptoWallet[]>([]);
  const [walletId, setWalletId] = useState('');
  const [addingWallet, setAddingWallet] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newNetwork, setNewNetwork] = useState<string>(CRYPTO_WALLET_NETWORKS[0]);
  const [newAddress, setNewAddress] = useState('');
  const [walletErr, setWalletErr] = useState('');

  useEffect(() => {
    if (!authenticated) return;
    const saved = loadSavedCryptoWallets();
    setWallets(saved);
    if (saved[0]) {
      setWalletId(saved[0].id);
      setAddingWallet(false);
    } else {
      setAddingWallet(true);
    }

    api<EligibleResponse>('/api/payouts/eligible')
      .then((res) => {
        setData(res);
        const first = res.accounts[0];
        if (first) {
          setChallengeId(first.id);
          const max = accountWithdrawable(first, Number(res.availableBalance || 0));
          if (max > 0) setAmount(String(Math.min(max, Number(max.toFixed(2)))));
        }
      })
      .catch((e) => {
        const msg = String(e.message || e);
        if (/unauthorized/i.test(msg)) {
          router.replace(`/login?next=${encodeURIComponent('/payouts/request')}`);
          return;
        }
        setErr(msg);
      });
  }, [authenticated, router]);

  const selected = useMemo(
    () => data?.accounts.find((a) => a.id === challengeId) ?? null,
    [data, challengeId],
  );
  const selectedWallet = useMemo(
    () => wallets.find((w) => w.id === walletId) ?? null,
    [wallets, walletId],
  );
  const maxAmount = selected
    ? accountWithdrawable(selected, Number(data?.availableBalance || 0))
    : 0;

  function onAccountChange(id: string) {
    setChallengeId(id);
    const acc = data?.accounts.find((a) => a.id === id);
    if (!acc || !data) return;
    const max = accountWithdrawable(acc, Number(data.availableBalance || 0));
    setAmount(max > 0 ? String(Number(max.toFixed(2))) : '');
  }

  /** Persist a new crypto wallet into Settings storage and select it. */
  function persistNewWallet(): SavedCryptoWallet | null {
    setWalletErr('');
    if (wallets.length >= 5) {
      setWalletErr('You can add up to 5 wallets.');
      return null;
    }
    if (!newAddress.trim()) {
      setWalletErr('Enter a wallet address.');
      return null;
    }
    const created: SavedCryptoWallet = {
      id: `w-${Date.now()}`,
      label: newLabel.trim() || newNetwork,
      network: newNetwork,
      address: newAddress.trim(),
    };
    const next = [...wallets, created];
    setWallets(next);
    saveCryptoWallets(next);
    setWalletId(created.id);
    setNewLabel('');
    setNewAddress('');
    setNewNetwork(CRYPTO_WALLET_NETWORKS[0]);
    setAddingWallet(false);
    return created;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setWalletErr('');
    if (!challengeId) {
      setErr('Select an eligible account');
      return;
    }
    const n = Number(amount);
    if (!(n > 0)) {
      setErr('Enter a valid amount');
      return;
    }
    if (n > maxAmount) {
      setErr(`Amount exceeds this account's profit share (${moneyPlain(maxAmount)})`);
      return;
    }

    let payoutWallet = selectedWallet;
    if (method === 'crypto') {
      if (addingWallet || !payoutWallet) {
        payoutWallet = persistNewWallet();
        if (!payoutWallet) return;
      }
    }

    setBusy(true);
    try {
      await api('/api/payouts/request', {
        method: 'POST',
        body: JSON.stringify({
          amount: n,
          challengeId,
          method,
          cryptoNetwork:
            method === 'crypto' && payoutWallet
              ? toPayoutNetwork(payoutWallet.network)
              : undefined,
          cryptoAddress: method === 'crypto' && payoutWallet ? payoutWallet.address : undefined,
        }),
      });
      router.push('/payouts');
    } catch (ex: any) {
      setErr(ex.message || 'request failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !authenticated) {
    return (
      <div className="rw-page">
        <div className="rw-heading">
          <h1>Request A Reward</h1>
        </div>
        <p className="meta">Checking session…</p>
      </div>
    );
  }

  if (!data && !err) {
    return (
      <div className="rw-page">
        <div className="rw-heading">
          <h1>Request A Reward</h1>
        </div>
        <p className="meta">Loading…</p>
      </div>
    );
  }

  const noEligible = !data?.accounts?.length;

  return (
    <div className="rw-page">
      <div className="rw-heading">
        <h1>Request A Reward</h1>
      </div>

      {err && <p className="err">{err}</p>}

      {noEligible ? (
        <div className="rw-empty-eligible">
          <div className="rw-empty-eligible-inner">
            <div className="rw-empty-eligible-icon">
              <CalIcon />
            </div>
            <h2>No Eligible Accounts</h2>
            <p>
              You don&apos;t have any accounts eligible for a reward yet. Keep trading and meet
              your targets to become eligible.
            </p>
            <div className="rw-empty-actions">
              <Link href="/payouts" className="rw-btn">
                <ArrowLeftIcon />
                Back to Rewards
              </Link>
              <Link href="/accounts" className="rw-btn rw-btn-secondary">
                <WalletIcon />
                View Accounts
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form className="rw-card rw-request-wizard" onSubmit={submit}>
          <p className="rw-form-hint">
            Rewards wallet: <strong>{moneyPlain(data!.availableBalance)}</strong>
            {' · '}
            You can only withdraw each funded account&apos;s <strong>profit share</strong>.
          </p>

          <label>
            Account
            <select value={challengeId} onChange={(e) => onAccountChange(e.target.value)} required>
              {data!.accounts.map((a) => {
                const w = accountWithdrawable(a, Number(data!.availableBalance || 0));
                return (
                  <option key={a.id} value={a.id}>
                    {accountNo(a)} · {typeLabel(a.sku)} · {sizeLabel(a.accountSize)} · up to{' '}
                    {moneyPlain(w)}
                  </option>
                );
              })}
            </select>
          </label>

          {selected && (
            <div className="rw-form-hint rw-profit-share">
              <div>
                Equity {moneyPlain(selected.equity ?? selected.accountSize)}
                {selected.platform ? ` · ${selected.platform}` : ''}
              </div>
              <div>
                Gross profit {moneyPlain(selected.grossProfit ?? 0)} · Split{' '}
                {selected.profitSplitPct ?? '—'}% · Cap {moneyPlain(selected.profitShareCap ?? 0)}
              </div>
              <div>
                Already requested {moneyPlain(selected.alreadyRequested ?? 0)} ·{' '}
                <strong>Withdrawable {moneyPlain(maxAmount)}</strong>
              </div>
            </div>
          )}

          <label>
            Amount (USD)
            <input
              type="number"
              min="0.01"
              max={maxAmount || undefined}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <fieldset className="rw-method">
            <legend>Payout method</legend>
            <div className="rw-method-options">
              {METHODS.map((m) => (
                <label key={m.id} className={method === m.id ? 'on' : ''}>
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          {method === 'crypto' && (
            <div className="rw-wallet-block">
              {wallets.length > 0 && !addingWallet ? (
                <>
                  <label>
                    Payout wallet
                    <select
                      value={walletId}
                      onChange={(e) => setWalletId(e.target.value)}
                      required
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label} · {w.network} · {w.address.slice(0, 8)}…{w.address.slice(-6)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedWallet && (
                    <p className="rw-form-hint">
                      Network <strong>{toPayoutNetwork(selectedWallet.network)}</strong>
                      <br />
                      Address <code>{selectedWallet.address}</code>
                    </p>
                  )}
                  <p className="rw-form-hint">
                    <button
                      type="button"
                      className="rw-link-btn"
                      onClick={() => {
                        setAddingWallet(true);
                        setWalletErr('');
                      }}
                    >
                      Add another wallet
                    </button>
                    {' · '}
                    <Link href="/settings/crypto-wallets">Manage wallets</Link>
                  </p>
                </>
              ) : (
                <fieldset className="rw-add-wallet">
                  <legend>{wallets.length === 0 ? 'Add payout wallet' : 'Add another wallet'}</legend>
                  <p className="rw-form-hint">
                    Saved under <strong>Settings → Crypto Wallets</strong> for future withdrawals.
                  </p>
                  <label>
                    Label (optional)
                    <input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. Main USDT"
                    />
                  </label>
                  <label>
                    Network
                    <select
                      value={newNetwork}
                      onChange={(e) => setNewNetwork(e.target.value)}
                      required
                    >
                      {CRYPTO_WALLET_NETWORKS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Wallet address
                    <input
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="Paste your payout address"
                      required={addingWallet}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  {walletErr && <p className="err">{walletErr}</p>}
                  <div className="rw-empty-actions">
                    {wallets.length > 0 && (
                      <button
                        type="button"
                        className="rw-btn rw-btn-secondary"
                        onClick={() => {
                          setAddingWallet(false);
                          setWalletErr('');
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      className="rw-btn"
                      onClick={() => {
                        persistNewWallet();
                      }}
                    >
                      Save wallet
                    </button>
                  </div>
                </fieldset>
              )}
            </div>
          )}

          {method === 'bank' && (
            <p className="rw-form-hint">
              Bank details will be collected by our team after you submit this request.
            </p>
          )}

          {method === 'rise' && (
            <p className="rw-form-hint">
              We will reach out with Rise onboarding instructions after you submit.
            </p>
          )}

          <div className="rw-empty-actions">
            <Link href="/payouts" className="rw-btn rw-btn-secondary">
              Cancel
            </Link>
            <button className="rw-btn" type="submit" disabled={busy || maxAmount <= 0}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
