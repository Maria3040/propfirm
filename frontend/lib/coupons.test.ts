import { describe, expect, it } from 'vitest';
import { payableTotal, shouldAttachCouponToLine } from './coupons';

describe('coupons helpers', () => {
  it('uses quoted final total when present', () => {
    expect(payableTotal(100, { code: 'WELCOME10', kind: 'percent', discountAmount: 10, finalTotal: 90, message: 'ok' })).toBe(90);
  });

  it('falls back when quote missing', () => {
    expect(payableTotal(100, null)).toBe(100);
  });

  it('attaches percent coupon to every line', () => {
    const q = { code: 'SAVE20', kind: 'percent', discountAmount: 20, finalTotal: 80, message: 'ok' };
    expect(shouldAttachCouponToLine(q, 0, false).attach).toBe(true);
    expect(shouldAttachCouponToLine(q, 1, false).attach).toBe(true);
  });

  it('attaches flat coupon only once', () => {
    const q = { code: 'FLAT50', kind: 'flat', discountAmount: 50, finalTotal: 50, message: 'ok' };
    const first = shouldAttachCouponToLine(q, 0, false);
    expect(first.attach).toBe(true);
    const second = shouldAttachCouponToLine(q, 1, first.nextFlatUsed);
    expect(second.attach).toBe(false);
  });
});
