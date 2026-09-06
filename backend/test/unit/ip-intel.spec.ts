import { extractClientIp, lookupIpIntel } from '../../src/infrastructure/ip-intel';

describe('extractClientIp', () => {
  it('prefers body clientIp over headers', () => {
    expect(
      extractClientIp(
        { 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2' },
        '3.3.3.3',
        '8.8.8.8',
      ),
    ).toBe('8.8.8.8');
  });

  it('uses cf-connecting-ip before x-real-ip', () => {
    expect(
      extractClientIp({
        'cf-connecting-ip': '9.9.9.9',
        'x-real-ip': '2.2.2.2',
        'x-forwarded-for': '1.1.1.1',
      }),
    ).toBe('9.9.9.9');
  });

  it('takes first hop from x-forwarded-for', () => {
    expect(extractClientIp({ 'x-forwarded-for': ' 10.0.0.5 , 10.0.0.6 ' })).toBe('10.0.0.5');
  });

  it('strips ipv4-mapped ipv6 prefix', () => {
    expect(extractClientIp({}, '::ffff:203.0.113.10')).toBe('203.0.113.10');
  });

  it('falls back to 0.0.0.0 when nothing is present', () => {
    expect(extractClientIp({})).toBe('0.0.0.0');
  });
});

describe('lookupIpIntel (unit / edge)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('classifies loopback as local without calling the network', async () => {
    global.fetch = jest.fn();
    const result = await lookupIpIntel('127.0.0.1');
    expect(result.connectionKind).toBe('local');
    expect(result.label).toBe('Local / Private network');
    expect(result.isVpn).toBe(false);
    expect(result.isVps).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('classifies RFC1918 addresses as local', async () => {
    for (const ip of ['10.1.2.3', '192.168.1.20', '172.16.0.1', '172.31.255.255']) {
      const result = await lookupIpIntel(ip);
      expect(result.connectionKind).toBe('local');
    }
  });

  it('marks proxy=true as VPN', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        country: 'Germany',
        countryCode: 'DE',
        city: 'Berlin',
        isp: 'VPN Co',
        org: 'VPN Co',
        proxy: true,
        hosting: true,
        query: '5.5.5.5',
      }),
    });
    const result = await lookupIpIntel('5.5.5.5');
    expect(result.connectionKind).toBe('vpn');
    expect(result.isVpn).toBe(true);
    expect(result.isVps).toBe(false);
    expect(result.countryCode).toBe('DE');
  });

  it('marks hosting without proxy as VPS / datacenter', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        country: 'United States',
        countryCode: 'US',
        city: 'Ashburn',
        isp: 'Cloud Host',
        org: 'Cloud Host',
        proxy: false,
        hosting: true,
        query: '8.8.8.8',
      }),
    });
    const result = await lookupIpIntel('8.8.8.8');
    expect(result.connectionKind).toBe('vps');
    expect(result.isVps).toBe(true);
    expect(result.label).toBe('VPS / Datacenter');
  });

  it('marks non-proxy non-hosting as residential (real IP)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        country: 'Iran',
        countryCode: 'IR',
        city: 'Tehran',
        isp: 'ISP',
        org: 'ISP',
        proxy: false,
        hosting: false,
        query: '91.99.1.1',
      }),
    });
    const result = await lookupIpIntel('91.99.1.1');
    expect(result.connectionKind).toBe('residential');
    expect(result.label).toBe('Residential (real IP)');
  });

  it('returns unknown when the lookup API fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const result = await lookupIpIntel('203.0.113.50');
    expect(result.connectionKind).toBe('unknown');
    expect(result.ip).toBe('203.0.113.50');
  });

  it('returns unknown when API status is not success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'fail', message: 'reserved range' }),
    });
    const result = await lookupIpIntel('203.0.113.51');
    expect(result.connectionKind).toBe('unknown');
  });
});
