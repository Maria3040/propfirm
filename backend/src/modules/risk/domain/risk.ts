import { v4 as uuidv4 } from 'uuid';

export type RiskInput = {
  challengeId: string;
  startingBalance: number;
  equity: number;
  highWaterMark: number;
  dayPnl: number;
  tradingDays: number;
  profitTargetPct: number;
  dailyLossPct: number;
  maxLossPct: number;
  minTradingDays: number;
};

export type RiskResult =
  | { kind: 'ok' }
  | { kind: 'breach'; rule: string; reason: string }
  | { kind: 'target'; equity: number; tradingDays: number };

export class BreachRecord {
  constructor(
    public id: string,
    public challengeId: string,
    public rule: string,
    public reason: string,
    public createdAt: Date,
  ) {}

  static create(challengeId: string, rule: string, reason: string) {
    return new BreachRecord(uuidv4(), challengeId, rule, reason, new Date());
  }
}

/** Pure risk rules — no I/O (US-F1..F3). */
export function evaluateRisk(input: RiskInput): RiskResult {
  const dailyLimit = input.startingBalance * (input.dailyLossPct / 100);
  if (input.dayPnl <= -dailyLimit) {
    return {
      kind: 'breach',
      rule: 'DailyLoss',
      reason: `Daily loss ${input.dayPnl.toFixed(2)} exceeded -${dailyLimit.toFixed(2)}`,
    };
  }
  const maxLossFloor = input.startingBalance * (1 - input.maxLossPct / 100);
  if (input.equity < maxLossFloor) {
    return {
      kind: 'breach',
      rule: 'MaxDrawdown',
      reason: `Equity ${input.equity.toFixed(2)} below floor ${maxLossFloor.toFixed(2)}`,
    };
  }
  const target = input.startingBalance * (1 + input.profitTargetPct / 100);
  if (input.equity >= target && input.tradingDays >= input.minTradingDays) {
    return { kind: 'target', equity: input.equity, tradingDays: input.tradingDays };
  }
  if (input.equity >= target && input.tradingDays < input.minTradingDays) {
    return { kind: 'ok' };
  }
  return { kind: 'ok' };
}
