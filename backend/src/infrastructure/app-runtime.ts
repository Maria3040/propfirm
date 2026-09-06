import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { InProcessBus } from '../bus/bus';
import { DomainError, EventMediator } from '../shared-kernel';
import { MockPaymentGateway } from './mock-payment';
import { sendSmtpEmail } from './smtp';
import {
  AuditEntity,
  BreachEntity,
  ChallengeEntity,
  CompetitionJoinEntity,
  EquitySnapshotEntity,
  NotificationEntity,
  OrderEntity,
  PayoutEntity,
  ProductEntity,
  TradeEntity,
  TraderEntity,
  TradingAccountEntity,
  WalletEntity,
} from '../persistence/entities';
import {
  ChallengeFailedEvent,
  ChallengeFundedEvent,
  ChallengePassedEvent,
  ChallengePurchasedEvent,
  ChallengeStartedEvent,
  EquityUpdatedEvent,
  EvaluationTargetReachedEvent,
  PayoutCompletedEvent,
  RiskBreachEvent,
  TradeRecordedEvent,
  UserRegisteredEvent,
} from '../contracts/events';
import {
  ChallengeActivatedDomainEvent,
  ChallengeInstance,
} from '../modules/challenges/domain/challenge';
import { OrderPaidDomainEvent, OrderRecord } from '../modules/commerce/domain/order';
import { Trade, TradingAccount, platformLabel } from '../modules/trading/domain/trading';
import { BreachRecord, evaluateRisk } from '../modules/risk/domain/risk';
import { PayoutRequest, TraderWallet } from '../modules/payouts/domain/payout';

@Injectable()
export class AppRuntime implements OnModuleInit {
  readonly bus = new InProcessBus();
  readonly mediator = new EventMediator();
  readonly payments = new MockPaymentGateway();
  private wired = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TraderEntity) private readonly traders: Repository<TraderEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(ChallengeEntity) private readonly challenges: Repository<ChallengeEntity>,
    @InjectRepository(TradingAccountEntity)
    private readonly accounts: Repository<TradingAccountEntity>,
    @InjectRepository(TradeEntity) private readonly trades: Repository<TradeEntity>,
    @InjectRepository(EquitySnapshotEntity)
    private readonly snapshots: Repository<EquitySnapshotEntity>,
    @InjectRepository(BreachEntity) private readonly breaches: Repository<BreachEntity>,
    @InjectRepository(WalletEntity) private readonly wallets: Repository<WalletEntity>,
    @InjectRepository(PayoutEntity) private readonly payouts: Repository<PayoutEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(AuditEntity) private readonly audits: Repository<AuditEntity>,
    @InjectRepository(CompetitionJoinEntity)
    private readonly competitionJoins: Repository<CompetitionJoinEntity>,
  ) {}

  async onModuleInit() {
    await this.ensureSchemas();
    this.wire();
    await this.seed();
  }

  private async ensureSchemas() {
    for (const s of [
      'users',
      'catalog',
      'commerce',
      'challenges',
      'trading',
      'risk',
      'payouts',
      'notifications',
      'audithub',
      'competitions',
    ]) {
      await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
    }
  }

  async dispatchEntityEvents(entity: { domainEvents(): any[]; clearDomainEvents(): void }) {
    const events = entity.domainEvents();
    entity.clearDomainEvents();
    await this.mediator.dispatch(events);
  }

  private async notify(toEmail: string, subject: string, body: string) {
    const { ok, detail } = await sendSmtpEmail({ toEmail, subject, body });
    await this.notifications.save(
      this.notifications.create({
        id: uuidv4(),
        toEmail,
        subject,
        body,
        status: ok ? 'Sent' : 'Failed',
        deliveryDetail: detail,
        createdAt: new Date(),
      }),
    );
    return ok;
  }

  private async audit(event: any) {
    try {
      const payload = { ...event };
      let summary = JSON.stringify(payload);
      if (summary.length > 240) summary = summary.slice(0, 240) + '…';
      await this.audits.save(
        this.audits.create({
          id: uuidv4(),
          eventType: event.constructor.name,
          source: event.source || 'unknown',
          summary,
          payloadJson: JSON.stringify(payload),
          occurredAt: new Date(),
        }),
      );
    } catch {
      /* never fail traveler flow */
    }
  }

  private async seed() {
    const expected = 5 * 3 + 5 + 5; // two_step×3 variants + one_step + zero
    const count = await this.products.count();
    if (count < expected) {
      await this.products.clear();
      const { buildCatalogSeed } = await import('./catalog-seed');
      await this.products.save(buildCatalogSeed() as any);
    }

    for (const [email, password, display, role] of [
      ['trader@propfirm.local', 'Trader1!', 'Demo Trader', 'Trader'],
      ['admin@propfirm.local', 'Admin1!', 'Demo Admin', 'Admin'],
    ] as const) {
      const existing = await this.traders
        .createQueryBuilder('t')
        .where('LOWER(t.email) = LOWER(:email)', { email })
        .getOne();
      if (existing) continue;
      await this.traders.save(
        this.traders.create({
          id: uuidv4(),
          email,
          passwordHash: await bcrypt.hash(password, 10),
          displayName: display,
          role,
          createdAt: new Date(),
        }),
      );
    }

    await this.seedFundedDemoAccount();
  }

  /** Idempotent: Funded $100k account + wallet credit for demo trader (reward flow). */
  private async seedFundedDemoAccount() {
    const seedOrderId = 'seed-order-funded-demo';
    const existing = await this.challenges.findOne({ where: { orderId: seedOrderId } });
    if (existing) {
      // Ensure wallet has spendable balance for reward demos
      const traderId = existing.traderId;
      let wallet = await this.wallets.findOne({ where: { traderId } });
      if (!wallet) {
        await this.wallets.save(
          this.wallets.create({ traderId, availableBalance: 2500, updatedAt: new Date() }),
        );
      } else if (wallet.availableBalance < 100) {
        wallet.availableBalance = Number((wallet.availableBalance + 2500).toFixed(2));
        wallet.updatedAt = new Date();
        await this.wallets.save(wallet);
      }
      return;
    }

    const trader = await this.traders
      .createQueryBuilder('t')
      .where('LOWER(t.email) = LOWER(:email)', { email: 'trader@propfirm.local' })
      .getOne();
    if (!trader) return;

    const accountSize = 100_000;
    const challengeId = uuidv4();
    const product = (await this.products.find({ take: 1 }))[0];
    await this.challenges.save(
      this.challenges.create({
        id: challengeId,
        traderId: trader.id,
        orderId: seedOrderId,
        productId: product?.id ?? 'seed-product',
        sku: product?.sku ?? 'two_step-flex-100k',
        accountSize,
        phases: 2,
        currentPhase: 3,
        profitTargetPct: 5,
        phase1TargetPct: 8,
        phase2TargetPct: 5,
        dailyLossPct: 5,
        maxLossPct: 10,
        minTradingDays: 3,
        status: 'Funded',
        failReason: null,
        createdAt: new Date(),
      }),
    );

    const login = String(80000000 + Math.floor(Math.random() * 9999999));
    const equity = accountSize * 1.12;
    await this.accounts.save(
      this.accounts.create({
        id: uuidv4(),
        challengeId,
        traderId: trader.id,
        login,
        password: 'FundedDemo1!',
        platform: 'mt5',
        server: 'PropFirm-Demo-MT5',
        startingBalance: accountSize,
        equity,
        highWaterMark: equity,
        locked: false,
        createdAt: new Date(),
      }),
    );

    const credit = 2500;
    let wallet = await this.wallets.findOne({ where: { traderId: trader.id } });
    if (!wallet) {
      await this.wallets.save(
        this.wallets.create({
          traderId: trader.id,
          availableBalance: credit,
          updatedAt: new Date(),
        }),
      );
    } else {
      wallet.availableBalance = Number((wallet.availableBalance + credit).toFixed(2));
      wallet.updatedAt = new Date();
      await this.wallets.save(wallet);
    }
  }

  private wire() {
    if (this.wired) return;
    this.wired = true;

    this.mediator.register(OrderPaidDomainEvent, async (e: OrderPaidDomainEvent) => {
      await this.bus.publish(
        new ChallengePurchasedEvent(
          e.orderId,
          e.productId,
          e.traderId,
          e.accountSize,
          e.price,
          e.sku,
          e.phases,
          e.profitTargetPct,
          e.phase1TargetPct,
          e.phase2TargetPct,
          e.dailyLossPct,
          e.maxLossPct,
          e.minTradingDays,
        ),
      );
    });

    this.bus.subscribe(ChallengePurchasedEvent, async (e: ChallengePurchasedEvent) => {
      const existing = await this.challenges.findOne({ where: { orderId: e.orderId } });
      if (existing) return;
      const challenge = ChallengeInstance.startFromPurchase({
        traderId: e.traderId,
        orderId: e.orderId,
        productId: e.productId,
        sku: e.sku,
        accountSize: e.accountSize,
        phases: e.phases,
        profitTargetPct: e.profitTargetPct,
        phase1TargetPct: e.phase1TargetPct,
        phase2TargetPct: e.phase2TargetPct,
        dailyLossPct: e.dailyLossPct,
        maxLossPct: e.maxLossPct,
        minTradingDays: e.minTradingDays,
      });
      await this.challenges.save(
        this.challenges.create({
          id: challenge.id,
          traderId: challenge.traderId,
          orderId: challenge.orderId,
          productId: challenge.productId,
          sku: challenge.sku,
          accountSize: challenge.accountSize,
          phases: challenge.phases,
          currentPhase: challenge.currentPhase,
          profitTargetPct: challenge.profitTargetPct,
          phase1TargetPct: challenge.phase1TargetPct,
          phase2TargetPct: challenge.phase2TargetPct,
          dailyLossPct: challenge.dailyLossPct,
          maxLossPct: challenge.maxLossPct,
          minTradingDays: challenge.minTradingDays,
          status: challenge.status,
          failReason: null,
          createdAt: challenge.createdAt,
        }),
      );
      await this.dispatchEntityEvents(challenge);
    });

    this.mediator.register(ChallengeActivatedDomainEvent, async (e: ChallengeActivatedDomainEvent) => {
      await this.bus.publish(
        new ChallengeStartedEvent(e.challengeId, e.traderId, e.accountSize, e.phase),
      );
    });

    this.bus.subscribe(ChallengeStartedEvent, async (e: ChallengeStartedEvent) => {
      let acc = await this.accounts.findOne({ where: { challengeId: e.challengeId } });
      if (!acc) {
        const challenge = await this.challenges.findOne({ where: { id: e.challengeId } });
        const order = challenge
          ? await this.orders.findOne({ where: { id: challenge.orderId } })
          : null;
        const platform = order?.platform || 'mt5';
        const domain = TradingAccount.provision(
          e.challengeId,
          e.traderId,
          e.accountSize,
          platform,
        );
        acc = await this.accounts.save(
          this.accounts.create({
            id: domain.id,
            challengeId: domain.challengeId,
            traderId: domain.traderId,
            login: domain.login,
            password: domain.password,
            platform: domain.platform,
            server: domain.server,
            startingBalance: domain.startingBalance,
            equity: domain.equity,
            highWaterMark: domain.highWaterMark,
            locked: false,
            createdAt: domain.createdAt,
          }),
        );

        const trader = await this.traders.findOne({ where: { id: e.traderId } });
        if (trader) {
          const sizeLabel =
            e.accountSize >= 1000 ? `$${e.accountSize / 1000}k` : `$${e.accountSize}`;
          const label = platformLabel(platform);
          await this.notify(
            trader.email,
            `Your ${label} account credentials`,
            [
              `Hi ${trader.displayName || 'trader'},`,
              '',
              'Your challenge purchase is confirmed. Use these credentials on your selected trading platform:',
              '',
              `Platform: ${label}`,
              `Server:   ${acc.server}`,
              `Login:    ${acc.login}`,
              `Password: ${acc.password}`,
              `Balance:  ${sizeLabel}`,
              `Challenge ID: ${e.challengeId}`,
              '',
              `Open ${label}, connect to server "${acc.server}", then sign in with the login and password above.`,
              '',
              `View your challenge: http://localhost:3100/challenges/${e.challengeId}`,
              '',
              '— PropFirm (demo)',
            ].join('\n'),
          );
        }
      } else {
        // new phase: reset equity
        acc.equity = e.accountSize;
        acc.startingBalance = e.accountSize;
        acc.highWaterMark = e.accountSize;
        acc.locked = false;
        await this.accounts.save(acc);
      }
    });

    this.bus.subscribe(TradeRecordedEvent, async (e: TradeRecordedEvent) => {
      const challenge = await this.challenges.findOne({ where: { id: e.challengeId } });
      const account = await this.accounts.findOne({ where: { id: e.accountId } });
      if (!challenge || !account || challenge.status !== 'Active') return;

      const dayKey = e.dayKey;
      const dayTrades = await this.trades
        .createQueryBuilder('t')
        .where('t.challenge_id = :cid', { cid: e.challengeId })
        .andWhere("to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') = :day", {
          day: dayKey,
        })
        .getMany();
      const dayPnl = dayTrades.reduce((s, t) => s + t.pnl, 0);
      const distinctDays = await this.dataSource.query(
        `SELECT COUNT(DISTINCT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'))::int AS c
         FROM trading.trades WHERE challenge_id = $1`,
        [e.challengeId],
      );
      const tradingDays = Number(distinctDays[0]?.c || 1);

      await this.snapshots.save(
        this.snapshots.create({
          challengeId: e.challengeId,
          equity: e.equity,
          dayPnl,
          tradingDays,
          createdAt: new Date(),
        }),
      );

      await this.bus.publish(
        new EquityUpdatedEvent(
          e.challengeId,
          e.equity,
          account.startingBalance,
          account.highWaterMark,
          dayPnl,
          tradingDays,
        ),
      );
    });

    this.bus.subscribe(EquityUpdatedEvent, async (e: EquityUpdatedEvent) => {
      const challenge = await this.challenges.findOne({ where: { id: e.challengeId } });
      if (!challenge || challenge.status !== 'Active') return;

      const result = evaluateRisk({
        challengeId: e.challengeId,
        startingBalance: e.startingBalance,
        equity: e.equity,
        highWaterMark: e.highWaterMark,
        dayPnl: e.dayPnl,
        tradingDays: e.tradingDays,
        profitTargetPct:
          challenge.currentPhase <= 1
            ? challenge.phase1TargetPct || challenge.profitTargetPct
            : challenge.phase2TargetPct || challenge.profitTargetPct,
        dailyLossPct: challenge.dailyLossPct,
        maxLossPct: challenge.maxLossPct,
        minTradingDays: challenge.minTradingDays,
      });

      if (result.kind === 'breach') {
        const breach = BreachRecord.create(e.challengeId, result.rule, result.reason);
        await this.breaches.save(
          this.breaches.create({
            id: breach.id,
            challengeId: breach.challengeId,
            rule: breach.rule,
            reason: breach.reason,
            createdAt: breach.createdAt,
          }),
        );
        await this.bus.publish(new RiskBreachEvent(e.challengeId, result.reason, result.rule));
      } else if (result.kind === 'target') {
        await this.bus.publish(
          new EvaluationTargetReachedEvent(e.challengeId, result.equity, result.tradingDays),
        );
      }
    });

    this.bus.subscribe(RiskBreachEvent, async (e: RiskBreachEvent) => {
      const challenge = await this.challenges.findOne({ where: { id: e.challengeId } });
      if (!challenge || challenge.status !== 'Active') return;
      const domain = new ChallengeInstance(
        challenge.id,
        challenge.traderId,
        challenge.orderId,
        challenge.productId,
        challenge.sku,
        challenge.accountSize,
        challenge.phases,
        challenge.currentPhase,
        challenge.profitTargetPct,
        challenge.phase1TargetPct || challenge.profitTargetPct,
        challenge.phase2TargetPct || 0,
        challenge.dailyLossPct,
        challenge.maxLossPct,
        challenge.minTradingDays,
        challenge.status,
        challenge.failReason,
        challenge.createdAt,
      );
      domain.markFailed(e.reason);
      challenge.status = domain.status;
      challenge.failReason = domain.failReason;
      await this.challenges.save(challenge);
      const account = await this.accounts.findOne({ where: { challengeId: e.challengeId } });
      if (account) {
        account.locked = true;
        await this.accounts.save(account);
      }
      await this.bus.publish(
        new ChallengeFailedEvent(challenge.id, challenge.traderId, e.reason),
      );
    });

    this.bus.subscribe(EvaluationTargetReachedEvent, async (e: EvaluationTargetReachedEvent) => {
      const challenge = await this.challenges.findOne({ where: { id: e.challengeId } });
      if (!challenge || challenge.status !== 'Active') return;
      const domain = new ChallengeInstance(
        challenge.id,
        challenge.traderId,
        challenge.orderId,
        challenge.productId,
        challenge.sku,
        challenge.accountSize,
        challenge.phases,
        challenge.currentPhase,
        challenge.profitTargetPct,
        challenge.phase1TargetPct || challenge.profitTargetPct,
        challenge.phase2TargetPct || 0,
        challenge.dailyLossPct,
        challenge.maxLossPct,
        challenge.minTradingDays,
        challenge.status,
        challenge.failReason,
        challenge.createdAt,
      );
      const outcome = domain.markPhasePassed();
      challenge.currentPhase = domain.currentPhase;
      challenge.status = domain.status;
      challenge.profitTargetPct = domain.profitTargetPct;
      await this.challenges.save(challenge);
      await this.dispatchEntityEvents(domain);

      if (outcome === 'funded') {
        // credit 10% of account size as demo profit share
        const credit = Number((challenge.accountSize * 0.1).toFixed(2));
        await this.bus.publish(
          new ChallengeFundedEvent(challenge.id, challenge.traderId, credit),
        );
        await this.bus.publish(
          new ChallengePassedEvent(challenge.id, challenge.traderId, challenge.currentPhase),
        );
      } else {
        await this.bus.publish(
          new ChallengePassedEvent(challenge.id, challenge.traderId, challenge.currentPhase - 1),
        );
      }
    });

    this.bus.subscribe(ChallengeFundedEvent, async (e: ChallengeFundedEvent) => {
      let walletRow = await this.wallets.findOne({ where: { traderId: e.traderId } });
      const wallet = walletRow
        ? new TraderWallet(walletRow.traderId, walletRow.availableBalance, walletRow.updatedAt)
        : TraderWallet.empty(e.traderId);
      wallet.credit(e.creditAmount);
      await this.wallets.save(
        this.wallets.create({
          traderId: wallet.traderId,
          availableBalance: wallet.availableBalance,
          updatedAt: wallet.updatedAt,
        }),
      );
    });

    this.bus.subscribe(ChallengeFailedEvent, async (e: ChallengeFailedEvent) => {
      const trader = await this.traders.findOne({ where: { id: e.traderId } });
      if (trader) {
        await this.notify(
          trader.email,
          'Challenge failed',
          `Challenge ${e.challengeId} failed: ${e.reason}`,
        );
      }
    });

    this.bus.subscribe(ChallengePassedEvent, async (e: ChallengePassedEvent) => {
      const trader = await this.traders.findOne({ where: { id: e.traderId } });
      if (trader) {
        await this.notify(
          trader.email,
          'Challenge phase passed',
          `Challenge ${e.challengeId} passed phase ${e.phase}.`,
        );
      }
    });

    this.bus.subscribe(ChallengeFundedEvent, async (e: ChallengeFundedEvent) => {
      const trader = await this.traders.findOne({ where: { id: e.traderId } });
      if (trader) {
        await this.notify(
          trader.email,
          'You are funded!',
          `Challenge ${e.challengeId} is Funded. Wallet credited $${e.creditAmount}.`,
        );
      }
    });

    this.bus.subscribe(PayoutCompletedEvent, async (e: PayoutCompletedEvent) => {
      const trader = await this.traders.findOne({ where: { id: e.traderId } });
      if (trader) {
        await this.notify(
          trader.email,
          'Payout approved',
          `Payout ${e.payoutId} of $${e.amount} was approved.`,
        );
      }
    });

    for (const et of [
      UserRegisteredEvent,
      ChallengePurchasedEvent,
      ChallengeStartedEvent,
      TradeRecordedEvent,
      RiskBreachEvent,
      EvaluationTargetReachedEvent,
      ChallengeFailedEvent,
      ChallengePassedEvent,
      ChallengeFundedEvent,
      PayoutCompletedEvent,
    ]) {
      this.bus.subscribe(et, async (event) => this.audit(event));
    }
  }

  // helpers used by controller
  get orderRepo() {
    return this.orders;
  }
  get productRepo() {
    return this.products;
  }
  get traderRepo() {
    return this.traders;
  }
  get challengeRepo() {
    return this.challenges;
  }
  get accountRepo() {
    return this.accounts;
  }
  get tradeRepo() {
    return this.trades;
  }
  get snapshotRepo() {
    return this.snapshots;
  }
  get walletRepo() {
    return this.wallets;
  }
  get payoutRepo() {
    return this.payouts;
  }
  get auditRepo() {
    return this.audits;
  }
  get notificationRepo() {
    return this.notifications;
  }
  get breachRepo() {
    return this.breaches;
  }

  async listJoinedCompetitionIds(traderId: string): Promise<string[]> {
    const rows = await this.competitionJoins.find({
      where: { traderId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => r.competitionId);
  }

  async joinCompetition(opts: {
    traderId: string;
    competitionId: string;
    competitionTitle: string;
  }): Promise<{ joined: boolean; alreadyJoined: boolean; emailSent: boolean }> {
    const trader = await this.traders.findOne({ where: { id: opts.traderId } });
    if (!trader) throw new DomainError('trader not found');

    const existing = await this.competitionJoins.findOne({
      where: { traderId: opts.traderId, competitionId: opts.competitionId },
    });
    if (existing) {
      return { joined: true, alreadyJoined: true, emailSent: false };
    }

    await this.competitionJoins.save(
      this.competitionJoins.create({
        id: uuidv4(),
        traderId: opts.traderId,
        competitionId: opts.competitionId,
        competitionTitle: opts.competitionTitle,
        createdAt: new Date(),
      }),
    );

    const subject = `You're in: ${opts.competitionTitle}`;
    const body = [
      `Hi ${trader.displayName},`,
      '',
      `You joined "${opts.competitionTitle}".`,
      '',
      'We will email you again when the competition starts with your credentials and rules reminder.',
      '',
      '— PropFirm Competitions',
    ].join('\n');

    const emailSent = await this.notify(trader.email, subject, body);

    return {
      joined: true,
      alreadyJoined: false,
      emailSent,
    };
  }

  async simulateTrade(
    challengeId: string,
    body: { symbol?: string; side?: string; lots?: number; pnl: number },
  ) {
    const challenge = await this.challenges.findOne({ where: { id: challengeId } });
    if (!challenge) throw new Error('challenge not found');
    if (challenge.status !== 'Active') throw new Error('challenge not active');
    const row = await this.accounts.findOne({ where: { challengeId } });
    if (!row) throw new Error('account not found');
    const account = new TradingAccount(
      row.id,
      row.challengeId,
      row.traderId,
      row.login,
      row.password,
      row.startingBalance,
      row.equity,
      row.highWaterMark,
      row.locked,
      row.createdAt,
      row.platform || 'mt5',
      row.server || 'PropFirm-Demo-MT5',
    );
    const trade = Trade.execute(
      account,
      body.symbol || 'EURUSD',
      body.side || 'buy',
      body.lots || 1,
      body.pnl,
    );
    row.equity = account.equity;
    row.highWaterMark = account.highWaterMark;
    await this.accounts.save(row);
    await this.trades.save(
      this.trades.create({
        id: trade.id,
        accountId: trade.accountId,
        challengeId: trade.challengeId,
        symbol: trade.symbol,
        side: trade.side,
        lots: trade.lots,
        pnl: trade.pnl,
        equityAfter: trade.equityAfter,
        createdAt: trade.createdAt,
      }),
    );
    const dayKey = new Date().toISOString().slice(0, 10);
    await this.bus.publish(
      new TradeRecordedEvent(
        challengeId,
        account.id,
        trade.id,
        trade.pnl,
        account.equity,
        dayKey,
      ),
    );
    return { trade, equity: account.equity, challengeStatus: (await this.challenges.findOne({ where: { id: challengeId } }))?.status };
  }

  async requestPayout(
    traderId: string,
    amount: number,
    opts?: {
      challengeId?: string;
      method?: string;
      cryptoNetwork?: string;
      cryptoAddress?: string;
    },
  ) {
    let walletRow = await this.wallets.findOne({ where: { traderId } });
    if (!walletRow) {
      walletRow = await this.wallets.save(
        this.wallets.create({ traderId, availableBalance: 0, updatedAt: new Date() }),
      );
    }
    const wallet = new TraderWallet(
      walletRow.traderId,
      walletRow.availableBalance,
      walletRow.updatedAt,
    );
    const method = (opts?.method || 'crypto').toLowerCase();
    if (method === 'crypto') {
      if (!opts?.cryptoNetwork?.trim()) throw new DomainError('crypto network is required');
      if (!opts?.cryptoAddress?.trim()) throw new DomainError('crypto address is required');
    }
    if (opts?.challengeId) {
      const challenge = await this.challenges.findOne({ where: { id: opts.challengeId } });
      if (!challenge || challenge.traderId !== traderId) {
        throw new DomainError('challenge not found');
      }
      if (challenge.status !== 'Funded') {
        throw new DomainError('account is not eligible for a reward');
      }
    }
    const req = PayoutRequest.request(traderId, amount, wallet);
    await this.payouts.save(
      this.payouts.create({
        id: req.id,
        traderId: req.traderId,
        amount: req.amount,
        status: req.status,
        challengeId: opts?.challengeId ?? null,
        method,
        rewardType: 'Profit share',
        cryptoNetwork: method === 'crypto' ? opts?.cryptoNetwork?.trim() ?? null : null,
        cryptoAddress: method === 'crypto' ? opts?.cryptoAddress?.trim() ?? null : null,
        createdAt: req.createdAt,
        decidedAt: null,
      }),
    );
    return {
      ...req,
      challengeId: opts?.challengeId ?? null,
      method,
      cryptoNetwork: method === 'crypto' ? opts?.cryptoNetwork?.trim() ?? null : null,
      cryptoAddress: method === 'crypto' ? opts?.cryptoAddress?.trim() ?? null : null,
    };
  }

  async decidePayout(payoutId: string, approve: boolean) {
    const row = await this.payouts.findOne({ where: { id: payoutId } });
    if (!row) throw new Error('payout not found');
    let walletRow = await this.wallets.findOne({ where: { traderId: row.traderId } });
    if (!walletRow) throw new Error('wallet not found');
    const wallet = new TraderWallet(
      walletRow.traderId,
      walletRow.availableBalance,
      walletRow.updatedAt,
    );
    const domain = new PayoutRequest(
      row.id,
      row.traderId,
      row.amount,
      row.status,
      row.createdAt,
      row.decidedAt,
    );
    if (approve) {
      domain.approve(wallet);
      walletRow.availableBalance = wallet.availableBalance;
      walletRow.updatedAt = wallet.updatedAt;
      await this.wallets.save(walletRow);
      await this.bus.publish(new PayoutCompletedEvent(row.id, row.traderId, row.amount));
    } else {
      domain.reject();
    }
    row.status = domain.status;
    row.decidedAt = domain.decidedAt;
    await this.payouts.save(row);
    return row;
  }
}
