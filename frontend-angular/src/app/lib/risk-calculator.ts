export type InstrumentType = 'Forex' | 'Metals' | 'Indices';

export type Instrument = {
  symbol: string;
  type: InstrumentType;
  /** Price move that equals 1 pip */
  pipSize: number;
  /** USD value of 1 pip for 1 standard lot */
  pipValue: number;
  /** Units per standard lot */
  contractSize: number;
  /** Default entry placeholder */
  placeholder: string;
};

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'EURUSD', type: 'Forex', pipSize: 0.0001, pipValue: 10, contractSize: 100_000, placeholder: '1.0850' },
  { symbol: 'GBPUSD', type: 'Forex', pipSize: 0.0001, pipValue: 10, contractSize: 100_000, placeholder: '1.2650' },
  { symbol: 'USDJPY', type: 'Forex', pipSize: 0.01, pipValue: 6.7, contractSize: 100_000, placeholder: '149.50' },
  { symbol: 'AUDUSD', type: 'Forex', pipSize: 0.0001, pipValue: 10, contractSize: 100_000, placeholder: '0.6550' },
  { symbol: 'USDCAD', type: 'Forex', pipSize: 0.0001, pipValue: 7.5, contractSize: 100_000, placeholder: '1.3650' },
  { symbol: 'USDCHF', type: 'Forex', pipSize: 0.0001, pipValue: 11.2, contractSize: 100_000, placeholder: '0.8850' },
  { symbol: 'NZDUSD', type: 'Forex', pipSize: 0.0001, pipValue: 10, contractSize: 100_000, placeholder: '0.5950' },
  { symbol: 'EURGBP', type: 'Forex', pipSize: 0.0001, pipValue: 12.5, contractSize: 100_000, placeholder: '0.8550' },
  { symbol: 'XAUUSD', type: 'Metals', pipSize: 0.01, pipValue: 1, contractSize: 100, placeholder: '2350.00' },
  { symbol: 'XAGUSD', type: 'Metals', pipSize: 0.001, pipValue: 50, contractSize: 5000, placeholder: '28.50' },
  { symbol: 'US30', type: 'Indices', pipSize: 1, pipValue: 1, contractSize: 1, placeholder: '39500' },
  { symbol: 'NAS100', type: 'Indices', pipSize: 1, pipValue: 1, contractSize: 1, placeholder: '17800' },
];

export type Direction = 'long' | 'short';
export type PriceMode = 'price' | 'pips';
export type TpMode = 'price' | 'pips' | 'rr';

export type CalcInput = {
  instrument: Instrument;
  direction: Direction;
  balance: number;
  riskPercent: number;
  leverage: number;
  entry: number;
  stopLoss: number;
  stopMode: PriceMode;
  takeProfit: number | null;
  tpMode: TpMode;
};

export type CalcResult = {
  riskAmount: number;
  stopPips: number;
  tpPips: number | null;
  lots: number;
  units: number;
  margin: number;
  rewardAmount: number | null;
  riskReward: number | null;
  stopPrice: number;
  tpPrice: number | null;
};

export function findInstrument(symbol: string) {
  return INSTRUMENTS.find((i) => i.symbol === symbol) || INSTRUMENTS[0];
}

function toStopPrice(entry: number, stop: number, mode: PriceMode, direction: Direction, pipSize: number) {
  if (mode === 'price') return stop;
  const dist = stop * pipSize;
  return direction === 'long' ? entry - dist : entry + dist;
}

function toTpPrice(
  entry: number,
  tp: number,
  mode: TpMode,
  direction: Direction,
  pipSize: number,
  stopPips: number,
) {
  if (mode === 'price') return tp;
  if (mode === 'pips') {
    const dist = tp * pipSize;
    return direction === 'long' ? entry + dist : entry - dist;
  }
  // R:R — tp is the ratio (e.g. 2 = 1:2)
  const dist = stopPips * tp * pipSize;
  return direction === 'long' ? entry + dist : entry - dist;
}

export function calculatePosition(input: CalcInput): CalcResult | null {
  const { instrument, direction, balance, riskPercent, leverage, entry, stopLoss, stopMode, takeProfit, tpMode } =
    input;

  if (!(balance > 0) || !(riskPercent > 0) || !(leverage > 0) || !(entry > 0) || !(stopLoss > 0)) {
    return null;
  }

  const stopPrice = toStopPrice(entry, stopLoss, stopMode, direction, instrument.pipSize);
  const stopDist = Math.abs(entry - stopPrice);
  if (stopDist <= 0) return null;

  // Direction sanity: long SL below entry, short SL above
  if (direction === 'long' && stopPrice >= entry) return null;
  if (direction === 'short' && stopPrice <= entry) return null;

  const stopPips = stopDist / instrument.pipSize;
  const riskAmount = balance * (riskPercent / 100);
  const lots = riskAmount / (stopPips * instrument.pipValue);
  if (!Number.isFinite(lots) || lots <= 0) return null;

  const units = lots * instrument.contractSize;
  const notional = lots * instrument.contractSize * entry;
  const margin = notional / leverage;

  let tpPips: number | null = null;
  let tpPrice: number | null = null;
  let rewardAmount: number | null = null;
  let riskReward: number | null = null;

  if (takeProfit != null && takeProfit > 0) {
    tpPrice = toTpPrice(entry, takeProfit, tpMode, direction, instrument.pipSize, stopPips);
    if (
      (direction === 'long' && tpPrice > entry) ||
      (direction === 'short' && tpPrice < entry)
    ) {
      tpPips = Math.abs(entry - tpPrice) / instrument.pipSize;
      rewardAmount = lots * tpPips * instrument.pipValue;
      riskReward = tpPips / stopPips;
    } else {
      tpPrice = null;
    }
  }

  return {
    riskAmount,
    stopPips,
    tpPips,
    lots,
    units,
    margin,
    rewardAmount,
    riskReward,
    stopPrice,
    tpPrice,
  };
}

export function formatMoney(n: number, digits = 2) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatLots(n: number) {
  if (n >= 10) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

export function formatPips(n: number) {
  return n.toFixed(1);
}
