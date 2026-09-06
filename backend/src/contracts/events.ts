import { v4 as uuidv4 } from 'uuid';

export class UserRegisteredEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Users';
  constructor(
    public userId: string,
    public email: string,
    public displayName: string,
    public role: string,
  ) {}
}

export class ChallengePurchasedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Commerce';
  constructor(
    public orderId: string,
    public productId: string,
    public traderId: string,
    public accountSize: number,
    public price: number,
    public sku: string,
    public phases: number,
    public profitTargetPct: number,
    public phase1TargetPct: number,
    public phase2TargetPct: number,
    public dailyLossPct: number,
    public maxLossPct: number,
    public minTradingDays: number,
  ) {}
}

export class ChallengeStartedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Challenges';
  constructor(
    public challengeId: string,
    public traderId: string,
    public accountSize: number,
    public phase: number,
  ) {}
}

export class TradeRecordedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Trading';
  constructor(
    public challengeId: string,
    public accountId: string,
    public tradeId: string,
    public pnl: number,
    public equity: number,
    public dayKey: string,
  ) {}
}

export class EquityUpdatedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Trading';
  constructor(
    public challengeId: string,
    public equity: number,
    public startingBalance: number,
    public highWaterMark: number,
    public dayPnl: number,
    public tradingDays: number,
  ) {}
}

export class RiskBreachEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Risk';
  constructor(
    public challengeId: string,
    public reason: string,
    public rule: string,
  ) {}
}

export class EvaluationTargetReachedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Risk';
  constructor(
    public challengeId: string,
    public equity: number,
    public tradingDays: number,
  ) {}
}

export class ChallengeFailedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Challenges';
  constructor(
    public challengeId: string,
    public traderId: string,
    public reason: string,
  ) {}
}

export class ChallengePassedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Challenges';
  constructor(
    public challengeId: string,
    public traderId: string,
    public phase: number,
  ) {}
}

export class ChallengeFundedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Challenges';
  constructor(
    public challengeId: string,
    public traderId: string,
    public creditAmount: number,
  ) {}
}

export class PayoutCompletedEvent {
  readonly eventId = uuidv4();
  readonly occurredAt = new Date();
  readonly source = 'Payouts';
  constructor(
    public payoutId: string,
    public traderId: string,
    public amount: number,
  ) {}
}
