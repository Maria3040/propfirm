export type SavedCryptoWallet = {
  id: string;
  label: string;
  network: string;
  address: string;
};

export const CRYPTO_WALLETS_STORAGE_KEY = 'propfirm_crypto_wallets';

export const CRYPTO_WALLET_NETWORKS = [
  'USDT (TRC20)',
  'USDT (ERC20)',
  'USDT (BEP20)',
  'BTC',
  'ETH',
  'USDC (ERC20)',
] as const;

/** Map settings-wallet network labels to payout API network strings. */
export function toPayoutNetwork(network: string): string {
  const n = network.trim();
  const map: Record<string, string> = {
    'USDT (TRC20)': 'USDT TRC20',
    'USDT (ERC20)': 'USDT ERC20',
    'USDT (BEP20)': 'USDT BEP20',
    'USDC (ERC20)': 'USDC ERC20',
    BTC: 'BTC',
    ETH: 'ETH',
  };
  return map[n] || n.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
}

export function loadSavedCryptoWallets(): SavedCryptoWallet[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CRYPTO_WALLETS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedCryptoWallet[]) : [];
  } catch {
    return [];
  }
}

export function saveCryptoWallets(wallets: SavedCryptoWallet[]) {
  localStorage.setItem(CRYPTO_WALLETS_STORAGE_KEY, JSON.stringify(wallets));
}
