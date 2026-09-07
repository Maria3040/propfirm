export type CompetitionStanding = {
  rank: number;
  name: string;
  country: string;
  trades: number;
  winRatio: number;
  profit: number;
  gainPct: number;
};

const NAMES = [
  'Raviraj K',
  'Brindawan J',
  'Jaiswal P',
  'KSHITIJ H',
  'V J',
  'MOHAMED D',
  'Divyansh g',
  'Tim F',
  'Daniel D',
  'Ulas S',
  'Tahere S',
  'Mert A',
  'Chun Man S',
  'Syedabu U',
  'Oleksandr M',
  'Jonathan B',
  'Poh J',
  'Antonio Gabriel B',
  'Łukasz M',
  'Govind S',
];

const COUNTRIES = ['IN', 'IN', 'IN', 'IN', 'IN', 'MA', 'IN', 'DE', 'US', 'TR', 'GB', 'DE', 'MY', 'GB', 'NL', 'PH', 'MY', 'RO', 'PL', 'IN'];

/** Deterministic demo standings per competition id. */
export function getCompetitionStandings(competitionId: string): CompetitionStanding[] {
  const seed = competitionId.split('').reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const rows: CompetitionStanding[] = [];
  for (let i = 0; i < 48; i++) {
    const profit = Math.max(
      1200,
      2_925_016 - i * (48_000 + (seed % 900)) + ((i * seed) % 12000),
    );
    rows.push({
      rank: i + 1,
      name: i < NAMES.length ? NAMES[i] : `Trader ${String.fromCharCode(65 + (i % 26))}${i}`,
      country: COUNTRIES[i % COUNTRIES.length],
      trades: 40 + ((i * 97 + seed) % 1200),
      winRatio: i < 3 && i !== 1 ? (i === 0 ? 0 : 0) : Number((((i * 13 + seed) % 90) + (i === 1 ? 88 : 0)).toFixed(0)) % 101,
      profit,
      gainPct: Number((profit / 1000).toFixed(2)),
    });
  }
  // Match reference top 3 shape for August-like ended comps
  rows[0] = {
    rank: 1,
    name: 'Raviraj K',
    country: 'IN',
    trades: 381,
    winRatio: 0,
    profit: 2_925_016.72,
    gainPct: 2925.02,
  };
  rows[1] = {
    rank: 2,
    name: 'Brindawan J',
    country: 'IN',
    trades: 170,
    winRatio: 88,
    profit: 2_102_067.82,
    gainPct: 2102.07,
  };
  rows[2] = {
    rank: 3,
    name: 'Jaiswal P',
    country: 'IN',
    trades: 640,
    winRatio: 0,
    profit: 2_089_559.86,
    gainPct: 2089.56,
  };
  rows[3] = {
    rank: 4,
    name: 'KSHITIJ H',
    country: 'IN',
    trades: 153,
    winRatio: 58,
    profit: 1_963_287.79,
    gainPct: 1963.29,
  };
  rows[4] = {
    rank: 5,
    name: 'V J',
    country: 'IN',
    trades: 1206,
    winRatio: 0,
    profit: 1_205_380.81,
    gainPct: 1205.38,
  };
  return rows;
}

export function formatStandingMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const COMPETITION_RULES = [
  '10% Max Overall Loss',
  '5% Max Daily Loss',
  'EA execution is prohibited',
];
