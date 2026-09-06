import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { settings } from '../config';
import { extractClientIp, lookupIpIntel } from '../infrastructure/ip-intel';
import { LoginHistoryEntity, ProductEntity, TraderEntity } from '../persistence/entities';
import { LoginArgs, ProductsArgs } from './args';
import { requireUser } from './auth';
import { AuthPayloadGql, LoginHistoryGql, ProductGql, UserGql } from './types';

@Resolver()
export class PropFirmResolver {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(TraderEntity) private readonly traders: Repository<TraderEntity>,
    @InjectRepository(ProductEntity) private readonly productsRepo: Repository<ProductEntity>,
    @InjectRepository(LoginHistoryEntity) private readonly loginHistoryRepo: Repository<LoginHistoryEntity>,
  ) {}

  private tokenFor(trader: TraderEntity): AuthPayloadGql {
    const accessToken = this.jwt.sign(
      { sub: trader.id, email: trader.email, role: trader.role, display_name: trader.displayName },
      {
        secret: settings.jwtKey,
        audience: settings.jwtAudience,
        issuer: settings.jwtIssuer,
        expiresIn: '8h',
      },
    );
    return {
      userId: trader.id,
      email: trader.email,
      displayName: trader.displayName,
      role: trader.role,
      accessToken,
    };
  }

  private async recordLogin(traderId: string, req: any, clientIp?: string) {
    const ip = extractClientIp(
      (req?.headers || {}) as Record<string, string | string[] | undefined>,
      req?.socket?.remoteAddress,
      clientIp,
    );
    const intel = await lookupIpIntel(ip);
    const ua = (req?.headers?.['user-agent'] || '').toString().slice(0, 500) || null;
    await this.loginHistoryRepo.save(
      this.loginHistoryRepo.create({
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

  @Query(() => String, { description: 'GraphQL health probe' })
  health(): string {
    return 'ok';
  }

  @Query(() => [ProductGql])
  async products(@Args() args: ProductsArgs): Promise<ProductGql[]> {
    const qb = this.productsRepo.createQueryBuilder('p').where('p.is_active = true');
    if (args.phaseFamily) qb.andWhere('p.phase_family = :phaseFamily', { phaseFamily: args.phaseFamily });
    if (args.variant) qb.andWhere('p.variant = :variant', { variant: args.variant });
    const rows = await qb.orderBy('p.account_size', 'ASC').getMany();
    return rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      description: p.description,
      phaseFamily: p.phaseFamily,
      variant: p.variant,
      accountSize: p.accountSize,
      price: p.price,
      comparePrice: p.comparePrice,
      phases: p.phases,
      profitTargetPct: p.profitTargetPct,
      dailyLossPct: p.dailyLossPct,
      maxLossPct: p.maxLossPct,
      minTradingDays: p.minTradingDays,
      isMostPopular: p.isMostPopular,
    }));
  }

  @Query(() => UserGql)
  async me(@Context() ctx: { req: any }): Promise<UserGql> {
    const u = requireUser(ctx.req?.headers?.authorization, this.jwt);
    const trader = await this.traders.findOne({ where: { id: u.sub } });
    if (!trader) throw new UnauthorizedException('unauthorized');
    return {
      id: trader.id,
      email: trader.email,
      displayName: trader.displayName,
      role: trader.role,
    };
  }

  @Query(() => [LoginHistoryGql])
  async loginHistory(@Context() ctx: { req: any }): Promise<LoginHistoryGql[]> {
    const u = requireUser(ctx.req?.headers?.authorization, this.jwt);
    const rows = await this.loginHistoryRepo.find({
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

  @Mutation(() => AuthPayloadGql)
  async login(@Args() args: LoginArgs, @Context() ctx: { req: any }): Promise<AuthPayloadGql> {
    const email = (args.email || '').trim();
    const password = args.password || '';
    const trader = await this.traders
      .createQueryBuilder('t')
      .where('LOWER(t.email) = LOWER(:email)', { email })
      .getOne();
    if (!trader || !(await bcrypt.compare(password, trader.passwordHash))) {
      throw new UnauthorizedException('unauthorized');
    }
    try {
      await this.recordLogin(trader.id, ctx.req, args.clientIp);
    } catch {
      /* non-fatal */
    }
    return this.tokenFor(trader);
  }
}
