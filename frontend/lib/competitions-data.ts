export type CompetitionStatus = 'ongoing' | 'ended' | 'upcoming';

export type Competition = {
  id: string;
  title: string;
  kind: 'Monthly Competition';
  host: string;
  platform: string;
  status: CompetitionStatus;
  endsAt: string;
  startsAt: string;
  participants: number;
  entry: 'Free' | string;
  featured?: boolean;
  prizeHtml: string;
  aboutHtml: string;
};

const DEFAULT_PRIZE = `
<ul>
  <li>1st place: 100K Evaluation (+$1500)</li>
  <li>2nd place: 100K Evaluation (+$1200)</li>
  <li>3rd place: 100K Evaluation (+$1000)</li>
  <li>4th place: 100K Evaluation</li>
  <li>5th place: 50K Evaluation</li>
  <li>6th / 10th: 25K Evaluation</li>
  <li>11th / 20th: 10K Evaluation</li>
</ul>
<p><strong>Compensation prize:</strong> Thirteen random participants, ranked from 4th place to 1000th place, will receive a cash compensation prize of $100.</p>
`;

const DEFAULT_ABOUT = `
<p>PropFirm Trading Competition</p>
<p>$5000 in cash and $675,000 worth of Evaluations.</p>
<p>The rules for the competition:</p>
<ul>
  <li>10% Maximum Loss Limit</li>
  <li>5% Maximum Daily Loss Limit</li>
  <li>EAs are not allowed</li>
  <li>Taking advantage of unrealistic fills in the demo environment is not allowed.</li>
</ul>
<p>Only one account per person is permitted.</p>
<p>If one of the rules is breached, you will be disqualified from the competition.</p>
<p>We have room for 50,000 participants. FULL = FULL</p>
<p><strong>Important Notice:</strong> Please be aware that the website link and your account credentials for competition accounts are different from those used for our evaluation accounts.</p>
<p><strong>To access your competition account on Match Trader, use the Credentials section on your account dashboard.</strong></p>
<p><strong>Make sure you are using the correct link and credentials to avoid any access issues.</strong></p>
`;

/** Demo catalog aligned with FundingPips monthly competitions. */
export const COMPETITIONS: Competition[] = [
  {
    id: '9efe870e-0341-4b13-9011-6d8529307f96',
    title: 'September 2026 Monthly Competition',
    kind: 'Monthly Competition',
    host: 'PropFirm',
    platform: 'matchtrader',
    status: 'ongoing',
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-09-30T15:00:00.000Z',
    participants: 26726,
    entry: 'Free',
    featured: true,
    prizeHtml: DEFAULT_PRIZE,
    aboutHtml: DEFAULT_ABOUT,
  },
  {
    id: 'd32377b2-6e5c-4e47-b6d4-89ff1ba3169e',
    title: 'August 2026 Monthly Competition',
    kind: 'Monthly Competition',
    host: 'PropFirm',
    platform: 'matchtrader',
    status: 'ended',
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-08-31T15:00:00.000Z',
    participants: 50001,
    entry: 'Free',
    prizeHtml: DEFAULT_PRIZE,
    aboutHtml: DEFAULT_ABOUT,
  },
  {
    id: '6e66f8e6-6537-41c6-9033-78f11b0fbd9c',
    title: 'July 2026 Monthly Competition',
    kind: 'Monthly Competition',
    host: 'PropFirm',
    platform: 'matchtrader',
    status: 'ended',
    startsAt: '2026-07-01T00:00:00.000Z',
    endsAt: '2026-07-31T15:00:00.000Z',
    participants: 50000,
    entry: 'Free',
    prizeHtml: DEFAULT_PRIZE,
    aboutHtml: DEFAULT_ABOUT,
  },
  {
    id: '5d0dbfee-396e-4611-8bd1-46ceaede2b58',
    title: 'June 2026 Monthly Competition',
    kind: 'Monthly Competition',
    host: 'PropFirm',
    platform: 'matchtrader',
    status: 'ended',
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-06-30T15:00:00.000Z',
    participants: 50000,
    entry: 'Free',
    prizeHtml: DEFAULT_PRIZE,
    aboutHtml: DEFAULT_ABOUT,
  },
  {
    id: 'a4d01741-1d1c-4441-bbdf-787a3f82cfa6',
    title: 'May 2026 Monthly Competition',
    kind: 'Monthly Competition',
    host: 'PropFirm',
    platform: 'matchtrader',
    status: 'ended',
    startsAt: '2026-05-01T00:00:00.000Z',
    endsAt: '2026-05-31T15:00:00.000Z',
    participants: 50000,
    entry: 'Free',
    prizeHtml: DEFAULT_PRIZE,
    aboutHtml: DEFAULT_ABOUT,
  },
  {
    id: '3d0bd4d7-e1a5-4f90-b13f-783ff975c327',
    title: 'April 2026 Monthly Competition',
    kind: 'Monthly Competition',
    host: 'PropFirm',
    platform: 'matchtrader',
    status: 'ended',
    startsAt: '2026-04-01T00:00:00.000Z',
    endsAt: '2026-04-30T15:00:00.000Z',
    participants: 50000,
    entry: 'Free',
    prizeHtml: DEFAULT_PRIZE,
    aboutHtml: DEFAULT_ABOUT,
  },
];

export function findCompetition(id: string) {
  return COMPETITIONS.find((c) => c.id === id);
}

export function formatCountdown(endsAt: string, now = Date.now()) {
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  if (diff <= 0) return '00:00:00';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(days)}:${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
