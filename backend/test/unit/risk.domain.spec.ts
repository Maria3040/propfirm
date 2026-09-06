import { evaluateRisk } from '../../src/modules/risk/domain/risk';

const base = {
  challengeId: 'c1',
  startingBalance: 100_000,
  equity: 100_000,
  highWaterMark: 100_000,
  dayPnl: 0,
  tradingDays: 5,
  profitTargetPct: 8,
  dailyLossPct: 5,
  maxLossPct: 10,
  minTradingDays: 3,
};

describe('evaluateRisk (unit / edge)', () => {
  it('returns ok for a healthy account', () => {
    expect(evaluateRisk(base)).toEqual({ kind: 'ok' });
  });

  it('breaches daily loss exactly at the limit (edge)', () => {
    const result = evaluateRisk({ ...base, dayPnl: -5000 });
    expect(result.kind).toBe('breach');
    if (result.kind === 'breach') expect(result.rule).toBe('DailyLoss');
  });

  it('does not breach daily loss one cent above the floor', () => {
    expect(evaluateRisk({ ...base, dayPnl: -4999.99 }).kind).toBe('ok');
  });

  it('breaches max drawdown when equity falls below floor', () => {
    const result = evaluateRisk({ ...base, equity: 89_999 });
    expect(result.kind).toBe('breach');
    if (result.kind === 'breach') expect(result.rule).toBe('MaxDrawdown');
  });

  it('hits target when equity and min days are met', () => {
    const result = evaluateRisk({ ...base, equity: 108_000, tradingDays: 3 });
    expect(result).toEqual({ kind: 'target', equity: 108_000, tradingDays: 3 });
  });

  it('stays ok when target is hit but min days are not (edge)', () => {
    expect(evaluateRisk({ ...base, equity: 108_000, tradingDays: 2 }).kind).toBe('ok');
  });

  it('handles zero starting balance without throwing (edge)', () => {
    expect(() =>
      evaluateRisk({ ...base, startingBalance: 0, equity: 0, dayPnl: 0 }),
    ).not.toThrow();
  });
});
