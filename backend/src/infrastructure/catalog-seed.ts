import { v4 as uuidv4 } from 'uuid';
import { ProductEntity } from '../persistence/entities';

type SizeRow = {
  size: number;
  price: number;
  compare?: number;
  avg: number;
  popular?: boolean;
};

const SIZES = [5000, 10000, 25000, 50000, 100000, 200000];

/** FundingPips-inspired 2-Step Flex ladder (home default). */
const TWO_STEP_FLEX: SizeRow[] = [
  { size: 5000, price: 32, avg: 389 },
  { size: 10000, price: 59, avg: 743 },
  { size: 25000, price: 159, avg: 1661 },
  { size: 50000, price: 269, avg: 2471 },
  { size: 100000, price: 499, compare: 555, avg: 5020, popular: true },
  { size: 200000, price: 999, avg: 10040 },
];

/** 2-Step Standard — Highest Profit Split. */
const TWO_STEP_STANDARD: SizeRow[] = [
  { size: 5000, price: 36, avg: 278 },
  { size: 10000, price: 66, avg: 531 },
  { size: 25000, price: 179, avg: 1187 },
  { size: 50000, price: 299, avg: 1766 },
  { size: 100000, price: 549, avg: 3587 },
  { size: 200000, price: 1099, avg: 7174 },
];

/** 2-Step Pro — FP checkout prices. */
const TWO_STEP_PRO: SizeRow[] = [
  { size: 5000, price: 29, avg: 231 },
  { size: 10000, price: 55, avg: 441 },
  { size: 25000, price: 134, avg: 986 },
  { size: 50000, price: 224, avg: 1467 },
  { size: 100000, price: 422, avg: 2980 },
  { size: 200000, price: 844, avg: 5960 },
];

type VariantMeta = {
  tagline: string;
  maxLoss: number;
  daily: number;
  p1: number;
  p2: number;
  split: number;
  minDays: number;
  rewardCycle: string;
  ladder: SizeRow[];
};

const VARIANT_META: Record<string, VariantMeta> = {
  standard: {
    tagline: 'Highest Profit Split',
    maxLoss: 10,
    daily: 5,
    p1: 8,
    p2: 5,
    split: 80,
    minDays: 3,
    rewardCycle: 'Biweekly',
    ladder: TWO_STEP_STANDARD,
  },
  flex: {
    tagline: 'Biggest Max Loss',
    maxLoss: 12,
    daily: 4,
    p1: 10,
    p2: 6,
    split: 95,
    minDays: 1,
    rewardCycle: 'Bi-Weekly',
    ladder: TWO_STEP_FLEX,
  },
  pro: {
    tagline: 'Lowest Profit Target',
    maxLoss: 6,
    daily: 3,
    p1: 6,
    p2: 6,
    split: 80,
    minDays: 2,
    rewardCycle: 'Weekly',
    ladder: TWO_STEP_PRO,
  },
};

function sizeLabel(n: number) {
  return n >= 1000 ? `${n / 1000}K` : String(n);
}

function buildTwoStep(variant: string): Partial<ProductEntity>[] {
  const meta = VARIANT_META[variant];
  return meta.ladder.map((row) => ({
    id: uuidv4(),
    sku: `2STEP-${variant.toUpperCase()}-${sizeLabel(row.size)}`,
    name: `2-Step ${variant[0].toUpperCase()}${variant.slice(1)} $${sizeLabel(row.size)}`,
    description: `2-phase evaluation · ${meta.tagline}`,
    phaseFamily: 'two_step',
    variant,
    variantTagline: meta.tagline,
    accountSize: row.size,
    price: row.price,
    comparePrice: row.compare ?? null,
    phases: 2,
    profitTargetPct: meta.p1,
    phase1TargetPct: meta.p1,
    phase2TargetPct: meta.p2,
    dailyLossPct: meta.daily,
    maxLossPct: meta.maxLoss,
    minTradingDays: meta.minDays,
    profitSplitPct: meta.split,
    rewardCycle: meta.rewardCycle,
    avgFirstReward: row.avg,
    isMostPopular: !!row.popular && variant === 'flex',
    isActive: true,
  }));
}

function buildOneStepFlex(): Partial<ProductEntity>[] {
  const prices = [66, 99, 199, 329, 599, 1199];
  const avgs = [350, 680, 1400, 2200, 4500, 9000];
  return SIZES.map((size, i) => ({
    id: uuidv4(),
    sku: `1STEP-FLEX-${sizeLabel(size)}`,
    name: `1-Step Flex $${sizeLabel(size)}`,
    description: 'Single-phase challenge · New',
    phaseFamily: 'one_step_flex',
    variant: 'flex',
    variantTagline: 'Biggest Max Loss',
    accountSize: size,
    price: prices[i],
    comparePrice: null,
    phases: 1,
    profitTargetPct: 10,
    phase1TargetPct: 10,
    phase2TargetPct: 0,
    dailyLossPct: 4,
    maxLossPct: 12,
    minTradingDays: 0,
    profitSplitPct: 95,
    rewardCycle: 'Bi-Weekly',
    avgFirstReward: avgs[i],
    isMostPopular: size === 100000,
    isActive: true,
  }));
}

function buildZero(): Partial<ProductEntity>[] {
  const prices = [60, 99, 219, 379, 699, 1399];
  const avgs = [400, 800, 1700, 2800, 5500, 11000];
  return SIZES.map((size, i) => ({
    id: uuidv4(),
    sku: `ZERO-${sizeLabel(size)}`,
    name: `Zero $${sizeLabel(size)}`,
    description: 'Instant / zero-step path (simulated)',
    phaseFamily: 'zero',
    variant: 'standard',
    variantTagline: 'Highest Profit Split',
    accountSize: size,
    price: prices[i],
    comparePrice: null,
    phases: 1,
    profitTargetPct: 0,
    phase1TargetPct: 0,
    phase2TargetPct: 0,
    dailyLossPct: 4,
    maxLossPct: 10,
    minTradingDays: 0,
    profitSplitPct: 85,
    rewardCycle: 'Weekly',
    avgFirstReward: avgs[i],
    isMostPopular: size === 100000,
    isActive: true,
  }));
}

export function buildCatalogSeed(): Partial<ProductEntity>[] {
  return [
    ...buildTwoStep('standard'),
    ...buildTwoStep('flex'),
    ...buildTwoStep('pro'),
    ...buildOneStepFlex(),
    ...buildZero(),
  ];
}
