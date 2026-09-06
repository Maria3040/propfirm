'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { accountNo, moneyPlain, sizeLabel, typeLabel } from '@/lib/accounts-format';

type EligibleAccount = {
  id: string;
  sku: string;
  status: string;
  accountSize: number;
  equity: number;
  login: string | null;
  platform: string | null;
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

const NETWORKS = ['USDT TRC20', 'USDT ERC20', 'USDT BEP20', 'BTC', 'ETH'] as const;

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

export default function RequestRewardPage() {
  const router = useRouter();
  const { ready, authenticated } = useRequireAuth('/payouts/request');
  const [data, setData] = useState<EligibleResponse | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('crypto');
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('USDT TRC20');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!authenticated) return;
    api<EligibleResponse>('/api/payouts/eligible')
      .then((res) => {
        setData(res);
        if (res.accounts[0]) {
          setChallengeId(res.accounts[0].id);
          const bal = Number(res.availableBalance || 0);
          if (bal > 0) setAmount(String(Math.min(bal, 100)));
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

  const maxAmount = data?.availableBalance ?? 0;
  const selected = useMemo(
    () => data?.accounts.find((a) => a.id === challengeId) ?? null,
    [data, challengeId],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
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
      setErr(`Amount exceeds available balance (${moneyPlain(maxAmount)})`);
      return;
    }
    if (method === 'crypto' && !address.trim()) {
      setErr('Enter your payout wallet address');
      return;
    }
    setBusy(true);
    try {
      await api('/api/payouts/request', {
        method: 'POST',
        body: JSON.stringify({
          amount: n,
          challengeId,
          method,
          cryptoNetwork: method === 'crypto' ? network : undefined,
          cryptoAddress: method === 'crypto' ? address.trim() : undefined,
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
            Available balance: <strong>{moneyPlain(maxAmount)}</strong>
          </p>

          <label>
            Account
            <select value={challengeId} onChange={(e) => setChallengeId(e.target.value)} required>
              {data!.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountNo(a)} · {typeLabel(a.sku)} · {sizeLabel(a.accountSize)} · Funded
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <p className="rw-form-hint">
              Equity {moneyPlain(selected.equity ?? selected.accountSize)}
              {selected.platform ? ` · ${selected.platform}` : ''}
            </p>
          )}

          <label>
            Amount (USD)
            <input
              type="number"
              min="1"
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
            <>
              <label>
                Network
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as (typeof NETWORKS)[number])}
                  required
                >
                  {NETWORKS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Wallet address
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste your payout address"
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </>
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
