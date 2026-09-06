import { DomainError, DomainEvent, Entity } from '../../../shared-kernel';
import { v4 as uuidv4 } from 'uuid';

export class OrderPaidDomainEvent extends DomainEvent {
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
  ) {
    super();
  }
}

export class OrderRecord extends Entity {
  constructor(
    public id: string,
    public traderId: string,
    public productId: string,
    public sku: string,
    public price: number,
    public accountSize: number,
    public phases: number,
    public profitTargetPct: number,
    public phase1TargetPct: number,
    public phase2TargetPct: number,
    public dailyLossPct: number,
    public maxLossPct: number,
    public minTradingDays: number,
    public status: string,
    public paymentIntentId: string | null,
    public createdAt: Date,
    public paidAt: Date | null,
    public addonSwapFree = false,
  ) {
    super();
  }

  static createPending(input: {
    traderId: string;
    productId: string;
    sku: string;
    price: number;
    accountSize: number;
    phases: number;
    profitTargetPct: number;
    phase1TargetPct: number;
    phase2TargetPct: number;
    dailyLossPct: number;
    maxLossPct: number;
    minTradingDays: number;
    paymentIntentId: string;
    addonSwapFree?: boolean;
  }) {
    return new OrderRecord(
      uuidv4(),
      input.traderId,
      input.productId,
      input.sku,
      input.price,
      input.accountSize,
      input.phases,
      input.profitTargetPct,
      input.phase1TargetPct,
      input.phase2TargetPct,
      input.dailyLossPct,
      input.maxLossPct,
      input.minTradingDays,
      'RequiresConfirmation',
      input.paymentIntentId,
      new Date(),
      null,
      !!input.addonSwapFree,
    );
  }

  confirmPaid() {
    if (this.status === 'Paid') return;
    if (this.status !== 'RequiresConfirmation') {
      throw new DomainError(`order cannot be paid in status ${this.status}`);
    }
    this.status = 'Paid';
    this.paidAt = new Date();
    this.addDomainEvent(
      new OrderPaidDomainEvent(
        this.id,
        this.productId,
        this.traderId,
        this.accountSize,
        this.price,
        this.sku,
        this.phases,
        this.profitTargetPct,
        this.phase1TargetPct,
        this.phase2TargetPct,
        this.dailyLossPct,
        this.maxLossPct,
        this.minTradingDays,
      ),
    );
  }

  markFailed(reason: string) {
    if (this.status === 'Paid') throw new DomainError('paid order cannot fail');
    this.status = 'Failed';
    void reason;
  }
}
