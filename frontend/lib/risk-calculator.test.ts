import { describe, expect, it } from 'vitest';
import { calculatePosition, findInstrument, formatLots } from './risk-calculator';

const eurusd = findInstrument('EURUSD');

describe('calculatePosition (unit / edge)', () => {
  it('computes lots for a long EURUSD risk', () => {
    const result = calculatePosition({
      instrument: eurusd,
      direction: 'long',
      balance: 10_000,
      riskPercent: 1,
      leverage: 100,
      entry: 1.1,
      stopLoss: 1.09,
      stopMode: 'price',
      takeProfit: 1.12,
      tpMode: 'price',
    });
    expect(result).not.toBeNull();
    expect(result!.riskAmount).toBe(100);
    expect(result!.stopPips).toBeCloseTo(100);
    expect(result!.lots).toBeCloseTo(0.1);
    expect(result!.riskReward).toBeCloseTo(2);
  });

  it('returns null when stop is on the wrong side of entry (edge)', () => {
    expect(
      calculatePosition({
        instrument: eurusd,
        direction: 'long',
        balance: 10_000,
        riskPercent: 1,
        leverage: 100,
        entry: 1.1,
        stopLoss: 1.11,
        stopMode: 'price',
        takeProfit: null,
        tpMode: 'price',
      }),
    ).toBeNull();
  });

  it('returns null for zero balance (edge)', () => {
    expect(
      calculatePosition({
        instrument: eurusd,
        direction: 'long',
        balance: 0,
        riskPercent: 1,
        leverage: 100,
        entry: 1.1,
        stopLoss: 50,
        stopMode: 'pips',
        takeProfit: null,
        tpMode: 'pips',
      }),
    ).toBeNull();
  });

  it('supports stop distance in pips', () => {
    const result = calculatePosition({
      instrument: eurusd,
      direction: 'short',
      balance: 5_000,
      riskPercent: 2,
      leverage: 50,
      entry: 1.2,
      stopLoss: 20,
      stopMode: 'pips',
      takeProfit: 2,
      tpMode: 'rr',
    });
    expect(result).not.toBeNull();
    expect(result!.stopPips).toBeCloseTo(20);
    expect(result!.riskReward).toBeCloseTo(2);
  });

  it('formats micro lots with 4 decimals', () => {
    expect(formatLots(0.0123)).toBe('0.0123');
    expect(formatLots(1.2)).toBe('1.200');
    expect(formatLots(12.345)).toBe('12.35');
  });
});
