export type CryptoBasketItem = {
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

export type CryptoInvoice = {
  invoiceId: string;
  amountUsd: number;
  currency: string;
  basket: CryptoBasketItem[];
  returnPath: string;
  email: string;
  createdAt: number;
};

const KEY = 'propfirm_crypto_invoice';

function randomId() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'inv';
  for (let i = 0; i < 13; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function createCryptoInvoice(input: Omit<CryptoInvoice, 'invoiceId' | 'createdAt'>): CryptoInvoice {
  const invoice: CryptoInvoice = {
    ...input,
    invoiceId: randomId(),
    createdAt: Date.now(),
  };
  sessionStorage.setItem(KEY, JSON.stringify(invoice));
  return invoice;
}

export function loadCryptoInvoice(): CryptoInvoice | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CryptoInvoice;
  } catch {
    return null;
  }
}

export function clearCryptoInvoice() {
  sessionStorage.removeItem(KEY);
}
