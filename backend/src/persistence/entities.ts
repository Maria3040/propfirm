import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'traders', schema: 'users' })
export class TraderEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 200 })
  displayName!: string;

  @Column({ type: 'varchar', length: 64 })
  role!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'challenge_products', schema: 'catalog' })
export class ProductEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** zero | one_step_flex | two_step */
  @Column({ name: 'phase_family', type: 'varchar', length: 32, default: 'two_step' })
  phaseFamily!: string;

  /** standard | flex | pro */
  @Column({ type: 'varchar', length: 32, default: 'flex' })
  variant!: string;

  @Column({ name: 'variant_tagline', type: 'varchar', length: 120, nullable: true })
  variantTagline!: string | null;

  @Column({ name: 'account_size', type: 'float' })
  accountSize!: number;

  @Column({ type: 'float' })
  price!: number;

  @Column({ name: 'compare_price', type: 'float', nullable: true })
  comparePrice!: number | null;

  @Column({ type: 'int' })
  phases!: number;

  /** Legacy / phase-1 default target */
  @Column({ name: 'profit_target_pct', type: 'float' })
  profitTargetPct!: number;

  @Column({ name: 'phase1_target_pct', type: 'float', default: 0 })
  phase1TargetPct!: number;

  @Column({ name: 'phase2_target_pct', type: 'float', default: 0 })
  phase2TargetPct!: number;

  @Column({ name: 'daily_loss_pct', type: 'float' })
  dailyLossPct!: number;

  @Column({ name: 'max_loss_pct', type: 'float' })
  maxLossPct!: number;

  @Column({ name: 'min_trading_days', type: 'int' })
  minTradingDays!: number;

  @Column({ name: 'profit_split_pct', type: 'float', default: 85 })
  profitSplitPct!: number;

  @Column({ name: 'reward_cycle', type: 'varchar', length: 64, default: 'Bi-Weekly' })
  rewardCycle!: string;

  @Column({ name: 'avg_first_reward', type: 'float', default: 0 })
  avgFirstReward!: number;

  @Column({ name: 'is_most_popular', default: false })
  isMostPopular!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}

@Entity({ name: 'orders', schema: 'commerce' })
export class OrderEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'trader_id', type: 'varchar', length: 64 })
  traderId!: string;

  @Column({ name: 'product_id', type: 'varchar', length: 64 })
  productId!: string;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'float' })
  price!: number;

  @Column({ name: 'account_size', type: 'float' })
  accountSize!: number;

  @Column({ type: 'int' })
  phases!: number;

  @Column({ name: 'profit_target_pct', type: 'float' })
  profitTargetPct!: number;

  @Column({ name: 'phase1_target_pct', type: 'float', default: 0 })
  phase1TargetPct!: number;

  @Column({ name: 'phase2_target_pct', type: 'float', default: 0 })
  phase2TargetPct!: number;

  @Column({ name: 'daily_loss_pct', type: 'float' })
  dailyLossPct!: number;

  @Column({ name: 'max_loss_pct', type: 'float' })
  maxLossPct!: number;

  @Column({ name: 'min_trading_days', type: 'int' })
  minTradingDays!: number;

  @Column({ name: 'addon_swap_free', default: false })
  addonSwapFree!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'mt5' })
  platform!: string;

  @Column({ type: 'varchar', length: 64 })
  status!: string;

  @Column({ name: 'payment_intent_id', type: 'varchar', length: 128, nullable: true })
  paymentIntentId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;
}

@Entity({ name: 'challenge_instances', schema: 'challenges' })
export class ChallengeEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'trader_id', type: 'varchar', length: 64 })
  traderId!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 64, unique: true })
  orderId!: string;

  @Column({ name: 'product_id', type: 'varchar', length: 64 })
  productId!: string;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ name: 'account_size', type: 'float' })
  accountSize!: number;

  @Column({ type: 'int' })
  phases!: number;

  @Column({ name: 'current_phase', type: 'int' })
  currentPhase!: number;

  @Column({ name: 'profit_target_pct', type: 'float' })
  profitTargetPct!: number;

  @Column({ name: 'phase1_target_pct', type: 'float', default: 0 })
  phase1TargetPct!: number;

  @Column({ name: 'phase2_target_pct', type: 'float', default: 0 })
  phase2TargetPct!: number;

  @Column({ name: 'daily_loss_pct', type: 'float' })
  dailyLossPct!: number;

  @Column({ name: 'max_loss_pct', type: 'float' })
  maxLossPct!: number;

  @Column({ name: 'min_trading_days', type: 'int' })
  minTradingDays!: number;

  @Column({ type: 'varchar', length: 64 })
  status!: string;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'trading_accounts', schema: 'trading' })
export class TradingAccountEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'challenge_id', type: 'varchar', length: 64, unique: true })
  challengeId!: string;

  @Column({ name: 'trader_id', type: 'varchar', length: 64 })
  traderId!: string;

  @Column({ type: 'varchar', length: 64 })
  login!: string;

  @Column({ type: 'varchar', length: 64 })
  password!: string;

  @Column({ type: 'varchar', length: 32, default: 'mt5' })
  platform!: string;

  @Column({ type: 'varchar', length: 128, default: 'PropFirm-Demo' })
  server!: string;

  @Column({ name: 'starting_balance', type: 'float' })
  startingBalance!: number;

  @Column({ type: 'float' })
  equity!: number;

  @Column({ name: 'high_water_mark', type: 'float' })
  highWaterMark!: number;

  @Column({ default: false })
  locked!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'trades', schema: 'trading' })
export class TradeEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'account_id', type: 'varchar', length: 64 })
  accountId!: string;

  @Column({ name: 'challenge_id', type: 'varchar', length: 64 })
  challengeId!: string;

  @Column({ type: 'varchar', length: 32 })
  symbol!: string;

  @Column({ type: 'varchar', length: 16 })
  side!: string;

  @Column({ type: 'float' })
  lots!: number;

  @Column({ type: 'float' })
  pnl!: number;

  @Column({ name: 'equity_after', type: 'float' })
  equityAfter!: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'equity_snapshots', schema: 'trading' })
export class EquitySnapshotEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'challenge_id', type: 'varchar', length: 64 })
  challengeId!: string;

  @Column({ type: 'float' })
  equity!: number;

  @Column({ name: 'day_pnl', type: 'float' })
  dayPnl!: number;

  @Column({ name: 'trading_days', type: 'int' })
  tradingDays!: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'breach_records', schema: 'risk' })
export class BreachEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'challenge_id', type: 'varchar', length: 64 })
  challengeId!: string;

  @Column({ type: 'varchar', length: 64 })
  rule!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'trader_wallets', schema: 'payouts' })
export class WalletEntity {
  @PrimaryColumn({ name: 'trader_id', type: 'varchar', length: 64 })
  traderId!: string;

  @Column({ name: 'available_balance', type: 'float', default: 0 })
  availableBalance!: number;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'payout_requests', schema: 'payouts' })
export class PayoutEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'trader_id', type: 'varchar', length: 64 })
  traderId!: string;

  @Column({ type: 'float' })
  amount!: number;

  @Column({ type: 'varchar', length: 64 })
  status!: string;

  @Column({ name: 'challenge_id', type: 'varchar', length: 64, nullable: true })
  challengeId!: string | null;

  @Column({ type: 'varchar', length: 64, default: 'crypto' })
  method!: string;

  @Column({ name: 'reward_type', type: 'varchar', length: 64, default: 'Profit share' })
  rewardType!: string;

  @Column({ name: 'crypto_network', type: 'varchar', length: 64, nullable: true })
  cryptoNetwork!: string | null;

  @Column({ name: 'crypto_address', type: 'varchar', length: 256, nullable: true })
  cryptoAddress!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;
}

@Entity({ name: 'notification_messages', schema: 'notifications' })
export class NotificationEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'to_email', type: 'varchar', length: 200 })
  toEmail!: string;

  @Column({ type: 'varchar', length: 300 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'varchar', length: 64 })
  status!: string;

  @Column({ name: 'delivery_detail', type: 'text', nullable: true })
  deliveryDetail!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'audit_entries', schema: 'audithub' })
export class AuditEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType!: string;

  @Column({ type: 'varchar', length: 120 })
  source!: string;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ name: 'payload_json', type: 'text' })
  payloadJson!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}

@Entity({ name: 'login_history', schema: 'users' })
export class LoginHistoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'trader_id', type: 'varchar', length: 64 })
  traderId!: string;

  @Column({ type: 'varchar', length: 64 })
  ip!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country!: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 8, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  isp!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  org!: string | null;

  /** vpn | vps | residential | local | unknown */
  @Column({ name: 'connection_kind', type: 'varchar', length: 32 })
  connectionKind!: string;

  @Column({ name: 'connection_label', type: 'varchar', length: 64 })
  connectionLabel!: string;

  @Column({ name: 'is_vpn', default: false })
  isVpn!: boolean;

  @Column({ name: 'is_vps', default: false })
  isVps!: boolean;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

export const ALL_ENTITIES = [
  TraderEntity,
  ProductEntity,
  OrderEntity,
  ChallengeEntity,
  TradingAccountEntity,
  TradeEntity,
  EquitySnapshotEntity,
  BreachEntity,
  WalletEntity,
  PayoutEntity,
  NotificationEntity,
  AuditEntity,
  LoginHistoryEntity,
];
