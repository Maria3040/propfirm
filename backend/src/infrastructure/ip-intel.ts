import { isIP } from 'net';

export type IpConnectionKind = 'vpn' | 'vps' | 'residential' | 'local' | 'unknown';

export type IpIntel = {
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isp: string | null;
  org: string | null;
  isVpn: boolean;
  isVps: boolean;
  connectionKind: IpConnectionKind;
  label: string;
};

function isPrivateIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/, '');
  if (v === '::1' || v === '127.0.0.1' || v === 'localhost') return true;
  if (isIP(v) === 0) return true;
  if (v.startsWith('10.')) return true;
  if (v.startsWith('192.168.')) return true;
  if (v.startsWith('169.254.')) return true;
  const m = /^172\.(\d+)\./.exec(v);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

function classify(proxy: boolean, hosting: boolean, local: boolean): IpConnectionKind {
  if (local) return 'local';
  if (proxy) return 'vpn';
  if (hosting) return 'vps';
  return 'residential';
}

function labelFor(kind: IpConnectionKind): string {
  switch (kind) {
    case 'vpn':
      return 'VPN / Proxy';
    case 'vps':
      return 'VPS / Datacenter';
    case 'residential':
      return 'Residential (real IP)';
    case 'local':
      return 'Local / Private network';
    default:
      return 'Unknown';
  }
}

export function extractClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
  bodyIp?: string,
): string {
  const pick = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v)?.trim();
  const forwarded = pick(headers['x-forwarded-for'])?.split(',')[0]?.trim();
  const real = pick(headers['x-real-ip']);
  const cf = pick(headers['cf-connecting-ip']);
  const candidates = [bodyIp, cf, real, forwarded, remoteAddress]
    .map((x) => (x || '').replace(/^::ffff:/, '').trim())
    .filter(Boolean);
  return candidates[0] || '0.0.0.0';
}

export async function lookupIpIntel(ip: string): Promise<IpIntel> {
  const clean = ip.replace(/^::ffff:/, '');
  if (isPrivateIp(clean)) {
    return {
      ip: clean,
      country: null,
      countryCode: null,
      city: null,
      isp: 'Private network',
      org: null,
      isVpn: false,
      isVps: false,
      connectionKind: 'local',
      label: labelFor('local'),
    };
  }

  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,message,country,countryCode,city,isp,org,as,proxy,hosting,query`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`ip-api ${res.status}`);
    const data = (await res.json()) as {
      status: string;
      message?: string;
      country?: string;
      countryCode?: string;
      city?: string;
      isp?: string;
      org?: string;
      proxy?: boolean;
      hosting?: boolean;
      query?: string;
    };
    if (data.status !== 'success') throw new Error(data.message || 'lookup failed');

    const isVpn = !!data.proxy;
    const isVps = !!data.hosting && !isVpn;
    const connectionKind = classify(isVpn, !!data.hosting, false);
    return {
      ip: data.query || clean,
      country: data.country || null,
      countryCode: data.countryCode || null,
      city: data.city || null,
      isp: data.isp || null,
      org: data.org || null,
      isVpn,
      isVps: connectionKind === 'vps',
      connectionKind,
      label: labelFor(connectionKind),
    };
  } catch {
    return {
      ip: clean,
      country: null,
      countryCode: null,
      city: null,
      isp: null,
      org: null,
      isVpn: false,
      isVps: false,
      connectionKind: 'unknown',
      label: labelFor('unknown'),
    };
  }
}
