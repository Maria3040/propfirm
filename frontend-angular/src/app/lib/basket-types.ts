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

export type CatalogProduct = {
  id: string;
  name?: string;
  sku?: string;
  phaseFamily: string;
  variant: string;
  accountSize: number;
  price: number;
  phase1TargetPct?: number | null;
  phase2TargetPct?: number | null;
  dailyLossPct: number;
  maxLossPct: number;
  minTradingDays: number;
};
