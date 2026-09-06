import {
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { settings } from '../config';
import { clearAuthCookie, setAuthCookie } from '../auth/auth-cookie';
import { AppRuntime } from '../infrastructure/app-runtime';
import { extractClientIp, lookupIpIntel } from '../infrastructure/ip-intel';
import { DomainError } from '../shared-kernel';
import { OrderRecord } from '../modules/commerce/domain/order';
import { UserRegisteredEvent } from '../contracts/events';
import {
  AuditEntity,
  ChallengeEntity,
  LoginHistoryEntity,
  NotificationEntity,
  OrderEntity,
  ProductEntity,
  TraderEntity,
} from '../persistence/entities';

@Controller()
export class ApiController {
  constructor(
    private readonly runtime: AppRuntime,
    private readonly jwt: JwtService,
    @InjectRepository(TraderEntity) private readonly traders: Repository<TraderEntity>,
    @InjectRepository(ProductEntity) private readonly products: Repository<ProductEntity>,
    @InjectRepository(OrderEntity) private readonly orders: Repository<OrderEntity>,
    @InjectRepository(ChallengeEntity) private readonly challenges: Repository<ChallengeEntity>,
    @InjectRepository(AuditEntity) private readonly audits: Repository<AuditEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(LoginHistoryEntity)
    private readonly loginHistory: Repository<LoginHistoryEntity>,
  ) {}

  @Get()
  root() {
    return {
      service: 'PropFirm modular API (NestJS DDD + TypeORM)',
      orm: 'TypeORM',
      docs: '/ (see README)',
      metrics: '/metrics',
    };
  }

  private userFromAuth(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwt.verify(authorization.slice(7).trim(), {
        secret: settings.jwtKey,
        audience: settings.jwtAudience,
        issuer: settings.jwtIssuer,
      });
      return payload as { sub: string; email: string; role: string };
    } catch {
      return null;
    }
  }

  private requireUser(authorization?: string) {
    const u = this.userFromAuth(authorization);
    if (!u?.sub) throw new HttpException('unauthorized', 401);
    return u;
  }

  private requireAdmin(authorization?: string) {
    const u = this.requireUser(authorization);
    if (u.role !== 'Admin') throw new HttpException('forbidden', 403);
    return u;
  }

  private tokenFor(trader: TraderEntity, res: Response) {
    const accessToken = this.jwt.sign(
      { sub: trader.id, email: trader.email, role: trader.role, display_name: trader.displayName },
      {
        secret: settings.jwtKey,
        audience: settings.jwtAudience,
        issuer: settings.jwtIssuer,
        expiresIn: '8h',
      },
    );
    setAuthCookie(res, accessToken);
    // JWT is httpOnly cookie only — never return the token in the JSON body.
    return {
      userId: trader.id,
      email: trader.email,
      displayName: trader.displayName,
      role: trader.role,
    };
  }

  private async recordLogin(traderId: string, req: Request, body?: { clientIp?: string }) {
    const ip = extractClientIp(
      req.headers as Record<string, string | string[] | undefined>,
      req.socket?.remoteAddress,
      body?.clientIp,
    );
    const intel = await lookupIpIntel(ip);
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 500) || null;
    await this.loginHistory.save(
      this.loginHistory.create({
        id: uuidv4(),
        traderId,
        ip: intel.ip,
        country: intel.country,
        countryCode: intel.countryCode,
        city: intel.city,
        isp: intel.isp,
        org: intel.org,
        connectionKind: intel.connectionKind,
        connectionLabel: intel.label,
        isVpn: intel.isVpn,
        isVps: intel.isVps,
        userAgent: ua,
        createdAt: new Date(),
      }),
    );
  }

  @Post('api/auth/register')
  async register(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = (body?.email || '').trim();
    const password = body?.password || '';
    const displayName = body?.displayName || email;
    if (!email || !password) throw new HttpException('email and password required', 400);
    const exists = await this.traders
      .createQueryBuilder('t')
      .where('LOWER(t.email) = LOWER(:email)', { email })
      .getOne();
    if (exists) throw new HttpException('email already registered', 400);
    const trader = await this.traders.save(
      this.traders.create({
        id: uuidv4(),
        email,
        passwordHash: await bcrypt.hash(password, 10),
        displayName,
        role: 'Trader',
        createdAt: new Date(),
      }),
    );
    await this.runtime.bus.publish(
      new UserRegisteredEvent(trader.id, trader.email, trader.displayName, trader.role),
    );
    try {
      await this.recordLogin(trader.id, req, body);
    } catch {
      /* non-fatal */
    }
    return this.tokenFor(trader, res);
  }

  @Post('api/auth/login')
  async login(
    @Body() body: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = (body?.email || '').trim();
    const password = body?.password || '';
    const trader = await this.traders
      .createQueryBuilder('t')
      .where('LOWER(t.email) = LOWER(:email)', { email })
      .getOne();
    if (!trader || !(await bcrypt.compare(password, trader.passwordHash))) {
      throw new HttpException('unauthorized', 401);
    }
    try {
      await this.recordLogin(trader.id, req, body);
    } catch {
      /* non-fatal */
    }
    return this.tokenFor(trader, res);
  }

  @Post('api/auth/logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return { ok: true };
  }

  @Get('api/users/me')
  async me(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    const trader = await this.traders.findOne({ where: { id: u.sub } });
    if (!trader) throw new HttpException('not found', 404);
    return {
      id: trader.id,
      email: trader.email,
      displayName: trader.displayName,
      role: trader.role,
    };
  }

  @Get('api/users/me/login-history')
  async myLoginHistory(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    const rows = await this.loginHistory.find({
      where: { traderId: u.sub },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      country: r.country,
      countryCode: r.countryCode,
      city: r.city,
      isp: r.isp,
      org: r.org,
      connectionKind: r.connectionKind,
      connectionLabel: r.connectionLabel,
      isVpn: r.isVpn,
      isVps: r.isVps,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    }));
  }

  @Get('api/catalog/products')
  async listProducts(
    @Query('phaseFamily') phaseFamily?: string,
    @Query('variant') variant?: string,
  ) {
    const qb = this.products
      .createQueryBuilder('p')
      .where('p.is_active = true')
      .orderBy('p.account_size', 'ASC');
    if (phaseFamily) qb.andWhere('p.phase_family = :phaseFamily', { phaseFamily });
    if (variant) qb.andWhere('p.variant = :variant', { variant });
    const rows = await qb.getMany();
    return rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      phaseFamily: p.phaseFamily,
      variant: p.variant,
      variantTagline: p.variantTagline,
      accountSize: p.accountSize,
      price: p.price,
      comparePrice: p.comparePrice,
      phases: p.phases,
      profitTargetPct: p.profitTargetPct,
      phase1TargetPct: p.phase1TargetPct,
      phase2TargetPct: p.phase2TargetPct,
      dailyLossPct: p.dailyLossPct,
      maxLossPct: p.maxLossPct,
      minTradingDays: p.minTradingDays,
      profitSplitPct: p.profitSplitPct,
      rewardCycle: p.rewardCycle,
      avgFirstReward: p.avgFirstReward,
      isMostPopular: p.isMostPopular,
    }));
  }

  @Get('api/catalog/products/:id')
  async getProduct(@Param('id') id: string) {
    const p = await this.products.findOne({ where: { id } });
    if (!p) throw new HttpException('not found', 404);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      phaseFamily: p.phaseFamily,
      variant: p.variant,
      variantTagline: p.variantTagline,
      accountSize: p.accountSize,
      price: p.price,
      comparePrice: p.comparePrice,
      phases: p.phases,
      profitTargetPct: p.profitTargetPct,
      phase1TargetPct: p.phase1TargetPct,
      phase2TargetPct: p.phase2TargetPct,
      dailyLossPct: p.dailyLossPct,
      maxLossPct: p.maxLossPct,
      minTradingDays: p.minTradingDays,
      profitSplitPct: p.profitSplitPct,
      rewardCycle: p.rewardCycle,
      avgFirstReward: p.avgFirstReward,
      isMostPopular: p.isMostPopular,
    };
  }

  @Post('api/orders')
  async createOrder(@Headers('authorization') authorization: string | undefined, @Body() body: any) {
    const u = this.requireUser(authorization);
    const product = await this.products.findOne({ where: { id: body?.productId, isActive: true } });
    if (!product) throw new HttpException('product not found', 404);
    const addonSwapFree = !!body?.addonSwapFree;
    const platformRaw = String(body?.platform || 'mt5').toLowerCase();
    const platform = ['mt5', 'matchtrader', 'ctrader'].includes(platformRaw)
      ? platformRaw
      : 'mt5';
    const platformFee = platform === 'ctrader' ? 20 : 0;
    const quantity = Math.min(10, Math.max(1, Number(body?.quantity) || 1));
    const unit = product.price * (addonSwapFree ? 1.1 : 1) + platformFee;
    const price = Number((unit * quantity).toFixed(2));
    const intent = this.runtime.payments.create(price);
    const order = OrderRecord.createPending({
      traderId: u.sub,
      productId: product.id,
      sku: product.sku,
      price,
      accountSize: product.accountSize,
      phases: product.phases,
      profitTargetPct: product.phase1TargetPct || product.profitTargetPct,
      phase1TargetPct: product.phase1TargetPct || product.profitTargetPct,
      phase2TargetPct: product.phase2TargetPct || 0,
      dailyLossPct: product.dailyLossPct,
      maxLossPct: product.maxLossPct,
      minTradingDays: product.minTradingDays,
      paymentIntentId: intent.id,
      addonSwapFree,
    });
    await this.orders.save(
      this.orders.create({
        id: order.id,
        traderId: order.traderId,
        productId: order.productId,
        sku: order.sku,
        price: order.price,
        accountSize: order.accountSize,
        phases: order.phases,
        profitTargetPct: order.profitTargetPct,
        phase1TargetPct: order.phase1TargetPct,
        phase2TargetPct: order.phase2TargetPct,
        dailyLossPct: order.dailyLossPct,
        maxLossPct: order.maxLossPct,
        minTradingDays: order.minTradingDays,
        addonSwapFree: order.addonSwapFree,
        platform,
        status: order.status,
        paymentIntentId: order.paymentIntentId,
        createdAt: order.createdAt,
        paidAt: null,
      }),
    );
    return {
      orderId: order.id,
      status: order.status,
      price: order.price,
      addonSwapFree,
      platform,
      paymentIntentId: intent.id,
      nextPath: `/checkout/confirm/${order.id}`,
    };
  }

  @Post('api/orders/:id/confirm')
  async confirmOrder(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const u = this.requireUser(authorization);
    const row = await this.orders.findOne({ where: { id } });
    if (!row || row.traderId !== u.sub) throw new HttpException('not found', 404);
    if (row.status === 'Paid') {
      const ch = await this.challenges.findOne({ where: { orderId: id } });
      return { orderId: id, status: 'Paid', challengeId: ch?.id, alreadyPaid: true };
    }
    if (!row.paymentIntentId) throw new HttpException('missing payment intent', 400);
    const pay = this.runtime.payments.confirm(row.paymentIntentId);
    if (!pay.ok) throw new HttpException(pay.error, 400);

    const order = new OrderRecord(
      row.id,
      row.traderId,
      row.productId,
      row.sku,
      row.price,
      row.accountSize,
      row.phases,
      row.profitTargetPct,
      row.phase1TargetPct || row.profitTargetPct,
      row.phase2TargetPct || 0,
      row.dailyLossPct,
      row.maxLossPct,
      row.minTradingDays,
      row.status,
      row.paymentIntentId,
      row.createdAt,
      row.paidAt,
      row.addonSwapFree,
    );
    try {
      order.confirmPaid();
    } catch (ex: any) {
      throw new HttpException(ex.message || 'error', 400);
    }
    row.status = order.status;
    row.paidAt = order.paidAt;
    await this.orders.save(row);
    await this.runtime.dispatchEntityEvents(order);
    const challenge = await this.challenges.findOne({ where: { orderId: id } });
    return {
      orderId: id,
      status: 'Paid',
      challengeId: challenge?.id,
      nextPath: challenge ? `/challenges/${challenge.id}` : '/dashboard',
    };
  }

  @Get('api/challenges')
  async listChallenges(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    const rows =
      u.role === 'Admin'
        ? await this.challenges.find({ order: { createdAt: 'DESC' } })
        : await this.challenges.find({ where: { traderId: u.sub }, order: { createdAt: 'DESC' } });
    const accounts = await this.runtime.accountRepo.find({
      where: u.role === 'Admin' ? {} : { traderId: u.sub },
    });
    const byChallenge = new Map(accounts.map((a) => [a.challengeId, a]));
    return rows.map((c) => {
      const account = byChallenge.get(c.id);
      const equity = account?.equity ?? c.accountSize;
      const pnl = equity - c.accountSize;
      return {
        ...c,
        equity,
        pnl,
        profitPct: (pnl / c.accountSize) * 100,
        login: account?.login ?? null,
        platform: account?.platform ?? null,
      };
    });
  }

  @Get('api/challenges/:id')
  async getChallenge(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const u = this.requireUser(authorization);
    const c = await this.challenges.findOne({ where: { id } });
    if (!c) throw new HttpException('not found', 404);
    if (u.role !== 'Admin' && c.traderId !== u.sub) throw new HttpException('forbidden', 403);
    const account = await this.runtime.accountRepo.findOne({ where: { challengeId: id } });
    const history = await this.runtime.snapshotRepo.find({
      where: { challengeId: id },
      order: { createdAt: 'ASC' },
      take: 60,
    });
    const snap = history.length ? history[history.length - 1] : undefined;
    const targetPct =
      c.currentPhase <= 1
        ? c.phase1TargetPct || c.profitTargetPct
        : c.phase2TargetPct || c.profitTargetPct;
    const targetEquity = c.accountSize * (1 + targetPct / 100);
    const equity = account?.equity ?? c.accountSize;
    const maxEquity = Math.max(
      equity,
      account?.highWaterMark ?? equity,
      ...history.map((h) => h.equity),
      c.accountSize,
    );
    return {
      ...c,
      account: account
        ? {
            id: account.id,
            login: account.login,
            password: account.password,
            platform: account.platform,
            server: account.server,
            equity: account.equity,
            startingBalance: account.startingBalance,
            highWaterMark: account.highWaterMark,
            locked: account.locked,
          }
        : null,
      progress: {
        equity,
        maxEquity,
        targetEquity,
        targetPct,
        profitPct: ((equity - c.accountSize) / c.accountSize) * 100,
        tradingDays: snap?.tradingDays ?? 0,
        minTradingDays: c.minTradingDays,
        dayPnl: snap?.dayPnl ?? 0,
      },
      equitySeries: history.map((h) => ({
        t: h.createdAt,
        equity: h.equity,
        dayPnl: h.dayPnl,
      })),
    };
  }

  @Post('api/challenges/:id/archive')
  async archiveChallenge(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    const u = this.requireUser(authorization);
    const c = await this.challenges.findOne({ where: { id } });
    if (!c) throw new HttpException('not found', 404);
    if (u.role !== 'Admin' && c.traderId !== u.sub) throw new HttpException('forbidden', 403);
    c.status = 'Closed';
    await this.challenges.save(c);
    const account = await this.runtime.accountRepo.findOne({ where: { challengeId: id } });
    if (account) {
      account.locked = true;
      await this.runtime.accountRepo.save(account);
    }
    return { ok: true, id: c.id, status: c.status };
  }

  @Post('api/challenges/:id/trades/simulate')
  async simulate(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    const u = this.requireUser(authorization);
    const c = await this.challenges.findOne({ where: { id } });
    if (!c) throw new HttpException('not found', 404);
    if (u.role !== 'Admin' && c.traderId !== u.sub) throw new HttpException('forbidden', 403);
    try {
      return await this.runtime.simulateTrade(id, {
        symbol: body?.symbol,
        side: body?.side,
        lots: body?.lots,
        pnl: Number(body?.pnl),
      });
    } catch (ex: any) {
      throw new HttpException(ex.message || 'error', 400);
    }
  }

  @Get('api/challenges/:id/trades')
  async trades(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.requireUser(authorization);
    return this.runtime.tradeRepo.find({
      where: { challengeId: id },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  @Get('api/challenges/:id/equity')
  async equity(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.requireUser(authorization);
    return this.runtime.snapshotRepo.find({
      where: { challengeId: id },
      order: { createdAt: 'ASC' },
      take: 200,
    });
  }

  @Get('api/payouts/wallet')
  async wallet(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    const w = await this.runtime.walletRepo.findOne({ where: { traderId: u.sub } });
    return { traderId: u.sub, availableBalance: w?.availableBalance ?? 0 };
  }

  @Get('api/payouts/eligible')
  async eligibleAccounts(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    const w = await this.runtime.walletRepo.findOne({ where: { traderId: u.sub } });
    const availableBalance = w?.availableBalance ?? 0;
    const funded = await this.challenges.find({
      where: { traderId: u.sub, status: 'Funded' },
      order: { createdAt: 'DESC' },
    });
    const accounts = await this.runtime.accountRepo.find({ where: { traderId: u.sub } });
    const byChallenge = new Map(accounts.map((a) => [a.challengeId, a]));
    return {
      availableBalance,
      accounts: funded.map((c) => {
        const account = byChallenge.get(c.id);
        return {
          id: c.id,
          sku: c.sku,
          status: c.status,
          accountSize: c.accountSize,
          equity: account?.equity ?? c.accountSize,
          login: account?.login ?? null,
          platform: account?.platform ?? null,
        };
      }),
    };
  }

  @Post('api/payouts/request')
  async requestPayout(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    const u = this.requireUser(authorization);
    try {
      const req = await this.runtime.requestPayout(u.sub, Number(body?.amount), {
        challengeId: body?.challengeId,
        method: body?.method,
        cryptoNetwork: body?.cryptoNetwork,
        cryptoAddress: body?.cryptoAddress,
      });
      return req;
    } catch (ex: any) {
      if (ex instanceof DomainError) throw new HttpException(ex.message, 400);
      throw new HttpException(ex.message || 'error', 400);
    }
  }

  @Get('api/payouts')
  async listPayouts(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    if (u.role === 'Admin') {
      return this.runtime.payoutRepo.find({ order: { createdAt: 'DESC' } });
    }
    return this.runtime.payoutRepo.find({
      where: { traderId: u.sub },
      order: { createdAt: 'DESC' },
    });
  }

  @Post('api/admin/payouts/:id/approve')
  async approvePayout(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.requireAdmin(authorization);
    try {
      return await this.runtime.decidePayout(id, true);
    } catch (ex: any) {
      throw new HttpException(ex.message || 'error', 400);
    }
  }

  @Post('api/admin/payouts/:id/reject')
  async rejectPayout(
    @Param('id') id: string,
    @Headers('authorization') authorization?: string,
  ) {
    this.requireAdmin(authorization);
    try {
      return await this.runtime.decidePayout(id, false);
    } catch (ex: any) {
      throw new HttpException(ex.message || 'error', 400);
    }
  }

  @Get('api/admin/audit')
  async audit(
    @Headers('authorization') authorization?: string,
    @Query('limit') limit?: string,
  ) {
    this.requireAdmin(authorization);
    return this.audits.find({
      order: { occurredAt: 'DESC' },
      take: Math.min(Number(limit) || 50, 200),
    });
  }

  @Get('api/competitions/joined')
  async listJoinedCompetitions(@Headers('authorization') authorization?: string) {
    const u = this.requireUser(authorization);
    const ids = await this.runtime.listJoinedCompetitionIds(u.sub);
    return { competitionIds: ids };
  }

  @Post('api/competitions/:id/join')
  async joinCompetition(
    @Param('id') id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: { title?: string },
  ) {
    const u = this.requireUser(authorization);
    const title = (body?.title || '').trim() || `Competition ${id}`;
    try {
      return await this.runtime.joinCompetition({
        traderId: u.sub,
        competitionId: id,
        competitionTitle: title,
      });
    } catch (ex: any) {
      if (ex instanceof DomainError) throw new HttpException(ex.message, 400);
      throw ex;
    }
  }

  @Get('api/notifications')
  async listNotifications(@Headers('authorization') authorization?: string) {
    this.requireUser(authorization);
    return this.notifications.find({ order: { createdAt: 'DESC' }, take: 50 });
  }
}
