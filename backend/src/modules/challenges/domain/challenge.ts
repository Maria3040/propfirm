import { DomainError, DomainEvent, Entity } from '../../../shared-kernel';
import { v4 as uuidv4 } from 'uuid';

export class ChallengeActivatedDomainEvent extends DomainEvent {
  constructor(
    public challengeId: string,
    public traderId: string,
    public accountSize: number,
    public phase: number,
  ) {
    super();
  }
}

export class ChallengeInstance extends Entity {
  constructor(
    public id: string,
    public traderId: string,
    public orderId: string,
    public productId: string,
    public sku: string,
    public accountSize: number,
    public phases: number,
    public currentPhase: number,
    public profitTargetPct: number,
    public phase1TargetPct: number,
    public phase2TargetPct: number,
    public dailyLossPct: number,
    public maxLossPct: number,
    public minTradingDays: number,
    public status: string,
    public failReason: string | null,
    public createdAt: Date,
  ) {
    super();
  }

  currentTargetPct() {
    if (this.currentPhase <= 1) {
      return this.phase1TargetPct || this.profitTargetPct;
    }
    return this.phase2TargetPct || this.profitTargetPct;
  }

  static startFromPurchase(input: {
    traderId: string;
    orderId: string;
    productId: string;
    sku: string;
    accountSize: number;
    phases: number;
    profitTargetPct: number;
    phase1TargetPct: number;
    phase2TargetPct: number;
    dailyLossPct: number;
    maxLossPct: number;
    minTradingDays: number;
  }) {
    const p1 = input.phase1TargetPct || input.profitTargetPct;
    const c = new ChallengeInstance(
      uuidv4(),
      input.traderId,
      input.orderId,
      input.productId,
      input.sku,
      input.accountSize,
      input.phases,
      1,
      p1,
      p1,
      input.phase2TargetPct || 0,
      input.dailyLossPct,
      input.maxLossPct,
      input.minTradingDays,
      'Active',
      null,
      new Date(),
    );
    c.addDomainEvent(
      new ChallengeActivatedDomainEvent(c.id, c.traderId, c.accountSize, c.currentPhase),
    );
    return c;
  }

  markFailed(reason: string) {
    if (this.status === 'Failed' || this.status === 'Funded') return;
    this.status = 'Failed';
    this.failReason = reason;
  }

  markPhasePassed() {
    if (this.status !== 'Active') {
      throw new DomainError(`cannot pass phase in status ${this.status}`);
    }
    if (this.currentPhase < this.phases) {
      this.currentPhase += 1;
      this.profitTargetPct = this.phase2TargetPct || this.profitTargetPct;
      this.status = 'Active';
      this.addDomainEvent(
        new ChallengeActivatedDomainEvent(
          this.id,
          this.traderId,
          this.accountSize,
          this.currentPhase,
        ),
      );
      return 'advanced';
    }
    this.status = 'Funded';
    return 'funded';
  }
}
