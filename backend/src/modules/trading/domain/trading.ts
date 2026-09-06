import { DomainError } from '../../../shared-kernel';
import { v4 as uuidv4 } from 'uuid';

export type TradingPlatform = 'mt5' | 'matchtrader' | 'ctrader' | string;

export function platformLabel(platform: TradingPlatform) {
  switch (platform) {
    case 'matchtrader':
      return 'MatchTrader';
    case 'ctrader':
      return 'cTrader';
    case 'mt5':
    default:
      return 'MetaTrader 5';
  }
}

export function platformServer(platform: TradingPlatform) {
  switch (platform) {
    case 'matchtrader':
      return 'PropFirm-MatchTrader';
    case 'ctrader':
      return 'PropFirm-cTrader';
    case 'mt5':
    default:
      return 'PropFirm-Demo-MT5';
  }
}

export class TradingAccount {
  constructor(
    public id: string,
    public challengeId: string,
    public traderId: string,
    public login: string,
    public password: string,
    public startingBalance: number,
    public equity: number,
    public highWaterMark: number,
    public locked: boolean,
    public createdAt: Date,
    public platform: TradingPlatform = 'mt5',
    public server: string = platformServer('mt5'),
  ) {}

  static provision(
    challengeId: string,
    traderId: string,
    accountSize: number,
    platform: TradingPlatform = 'mt5',
  ) {
    const id = uuidv4();
    const short = id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const numeric = String(10000000 + (parseInt(short.slice(0, 6), 16) % 89999999));
    let login = `PF${short}`;
    if (platform === 'mt5') login = numeric;
    if (platform === 'matchtrader') login = `mt_${short.toLowerCase()}`;
    if (platform === 'ctrader') login = `ct${numeric.slice(0, 7)}`;

    return new TradingAccount(
      id,
      challengeId,
      traderId,
      login,
      `Pwd_${short.slice(0, 6)}!`,
      accountSize,
      accountSize,
      accountSize,
      false,
      new Date(),
      platform,
      platformServer(platform),
    );
  }

  applyTrade(pnl: number) {
    if (this.locked) throw new DomainError('trading account is locked');
    this.equity = Number((this.equity + pnl).toFixed(2));
    if (this.equity > this.highWaterMark) this.highWaterMark = this.equity;
  }

  lock() {
    this.locked = true;
  }
}

export class Trade {
  constructor(
    public id: string,
    public accountId: string,
    public challengeId: string,
    public symbol: string,
    public side: string,
    public lots: number,
    public pnl: number,
    public equityAfter: number,
    public createdAt: Date,
  ) {}

  static execute(
    account: TradingAccount,
    symbol: string,
    side: string,
    lots: number,
    pnl: number,
  ) {
    account.applyTrade(pnl);
    return new Trade(
      uuidv4(),
      account.id,
      account.challengeId,
      symbol,
      side,
      lots,
      pnl,
      account.equity,
      new Date(),
    );
  }
}
