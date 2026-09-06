'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  CRYPTO_WALLET_NETWORKS,
  loadSavedCryptoWallets,
  saveCryptoWallets,
  type SavedCryptoWallet,
} from '@/lib/crypto-wallets';

function WalletIcon() {
  return (
    <svg width="40" height="40" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M216,64H56a8,8,0,0,1,0-16H192a8,8,0,0,0,0-16H56A24,24,0,0,0,32,56V184a24,24,0,0,0,24,24H216a16,16,0,0,0,16-16V80A16,16,0,0,0,216,64Zm0,128H56a8,8,0,0,1-8-8V78.63A23.84,23.84,0,0,0,56,80H216Zm-48-60a12,12,0,1,1,12,12A12,12,0,0,1,168,132Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256" aria-hidden>
      <path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z" />
    </svg>
  );
}

export default function CryptoWalletsPage() {
  const [wallets, setWallets] = useState<SavedCryptoWallet[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [network, setNetwork] = useState<string>(CRYPTO_WALLET_NETWORKS[0]);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWallets(loadSavedCryptoWallets());
  }, []);

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (wallets.length >= 5) {
      setError('You can add up to 5 wallets.');
      return;
    }
    if (!address.trim()) {
      setError('Enter a wallet address.');
      return;
    }
    const next = [
      ...wallets,
      {
        id: `w-${Date.now()}`,
        label: label.trim() || network,
        network,
        address: address.trim(),
      },
    ];
    setWallets(next);
    saveCryptoWallets(next);
    setLabel('');
    setAddress('');
    setNetwork(CRYPTO_WALLET_NETWORKS[0]);
    setOpen(false);
  };

  const remove = (id: string) => {
    const next = wallets.filter((w) => w.id !== id);
    setWallets(next);
    saveCryptoWallets(next);
  };

  return (
    <div className="settings-page">
      <header className="settings-page-head">
        <h1 className="settings-page-title">Crypto Wallets</h1>
        <button type="button" className="settings-save-btn scw-add" onClick={() => setOpen(true)}>
          <PlusIcon /> Add Wallet
        </button>
      </header>

      {wallets.length === 0 ? (
        <div className="sb-empty">
          <WalletIcon />
          <h3>No Crypto Wallets</h3>
          <p>
            Add your first crypto wallet to start receiving rewards via cryptocurrency. You can add
            up to 5 wallets. Saved wallets appear on the reward request form.
          </p>
        </div>
      ) : (
        <ul className="scw-list">
          {wallets.map((w) => (
            <li key={w.id} className="scw-item">
              <div>
                <strong>{w.label}</strong>
                <span className="scw-network">{w.network}</span>
                <code>{w.address}</code>
              </div>
              <button type="button" className="scw-remove" onClick={() => remove(w.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="scw-modal" role="dialog" aria-modal="true" aria-labelledby="add-wallet-title">
          <button type="button" className="scw-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
          <form className="scw-dialog" onSubmit={onAdd}>
            <h2 id="add-wallet-title">Add Wallet</h2>
            <div className="settings-field">
              <label htmlFor="wallet-label">Label (optional)</label>
              <input
                id="wallet-label"
                className="settings-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main USDT"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="wallet-network">Network</label>
              <select
                id="wallet-network"
                className="settings-select"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
              >
                {CRYPTO_WALLET_NETWORKS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label htmlFor="wallet-address">Address</label>
              <input
                id="wallet-address"
                className="settings-input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Wallet address"
                required
              />
            </div>
            {error ? <p className="ss-err">{error}</p> : null}
            <div className="scw-dialog-actions">
              <button type="button" className="scw-cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="settings-save-btn">
                Save Wallet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
