import { describe, expect, it } from 'vitest';
import { loginRedirectUrl } from './loginRedirect';

describe('loginRedirectUrl', () => {
  it('encodes payouts request return path', () => {
    expect(loginRedirectUrl('/payouts/request')).toBe(
      `/login?next=${encodeURIComponent('/payouts/request')}`,
    );
  });

  it('prefers explicit nextPath', () => {
    expect(loginRedirectUrl('/other', '/payouts')).toBe(
      `/login?next=${encodeURIComponent('/payouts')}`,
    );
  });
});
