import { DomainError } from '../../../shared-kernel';
import { v4 as uuidv4 } from 'uuid';

export class TraderWallet {
  constructor(
    public traderId: string,
    public availableBalance: number,
    public updatedAt: Date,
  ) {}

  static empty(traderId: string) {
    return new TraderWallet(traderId, 0, new Date());
  }

  credit(amount: number) {
    if (amount <= 0) throw new DomainError('credit must be positive');
    this.availableBalance = Number((this.availableBalance + amount).toFixed(2));
    this.updatedAt = new Date();
  }

  debit(amount: number) {
    if (amount <= 0) throw new DomainError('debit must be positive');
    if (amount > this.availableBalance) {
      throw new DomainError('insufficient wallet balance');
    }
    this.availableBalance = Number((this.availableBalance - amount).toFixed(2));
    this.updatedAt = new Date();
  }
}

export class PayoutRequest {
  constructor(
    public id: string,
    public traderId: string,
    public amount: number,
    public status: string,
    public createdAt: Date,
    public decidedAt: Date | null,
  ) {}

  static request(traderId: string, amount: number, wallet: TraderWallet) {
    if (amount > wallet.availableBalance) {
      throw new DomainError('payout exceeds available balance');
    }
    return new PayoutRequest(uuidv4(), traderId, amount, 'Pending', new Date(), null);
  }

  approve(wallet: TraderWallet) {
    if (this.status !== 'Pending') throw new DomainError('payout not pending');
    wallet.debit(this.amount);
    this.status = 'Approved';
    this.decidedAt = new Date();
  }

  reject() {
    if (this.status !== 'Pending') throw new DomainError('payout not pending');
    this.status = 'Rejected';
    this.decidedAt = new Date();
  }
}
