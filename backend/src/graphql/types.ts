import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AuthPayloadGql {
  @Field()
  userId!: string;

  @Field()
  email!: string;

  @Field()
  displayName!: string;

  @Field()
  role!: string;
}

@ObjectType()
export class UserGql {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field()
  displayName!: string;

  @Field()
  role!: string;
}

@ObjectType()
export class LoginHistoryGql {
  @Field()
  id!: string;

  @Field()
  ip!: string;

  @Field(() => String, { nullable: true })
  country!: string | null;

  @Field(() => String, { nullable: true })
  countryCode!: string | null;

  @Field(() => String, { nullable: true })
  city!: string | null;

  @Field(() => String, { nullable: true })
  isp!: string | null;

  @Field(() => String, { nullable: true })
  org!: string | null;

  @Field()
  connectionKind!: string;

  @Field()
  connectionLabel!: string;

  @Field()
  isVpn!: boolean;

  @Field()
  isVps!: boolean;

  @Field(() => String, { nullable: true })
  userAgent!: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class ProductGql {
  @Field()
  id!: string;

  @Field()
  sku!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  phaseFamily!: string;

  @Field()
  variant!: string;

  @Field(() => Float)
  accountSize!: number;

  @Field(() => Float)
  price!: number;

  @Field(() => Float, { nullable: true })
  comparePrice!: number | null;

  @Field(() => Int)
  phases!: number;

  @Field(() => Float)
  profitTargetPct!: number;

  @Field(() => Float)
  dailyLossPct!: number;

  @Field(() => Float)
  maxLossPct!: number;

  @Field(() => Int)
  minTradingDays!: number;

  @Field()
  isMostPopular!: boolean;
}
