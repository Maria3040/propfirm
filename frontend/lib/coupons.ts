/** Client helpers mirroring POST /api/coupons/validate responses. */

export type CouponQuote = {
  code: string;
  kind: 'percent' | 'flat' | string;
  discountAmount: number;
  finalTotal: number;
  message: string;
};

export function payableTotal(subtotal: number, quote: CouponQuote | null | undefined): number {
  if (!quote) return subtotal;
  const n = Number(quote.finalTotal);
  return Number.isFinite(n) ? n : subtotal;
}

export function shouldAttachCouponToLine(
  quote: CouponQuote | null | undefined,
  lineIndex: number,
  flatAlreadyUsed: boolean,
): { attach: boolean; nextFlatUsed: boolean } {
  if (!quote) return { attach: false, nextFlatUsed: flatAlreadyUsed };
  if (quote.kind === 'flat') {
    if (flatAlreadyUsed) return { attach: false, nextFlatUsed: true };
    return { attach: true, nextFlatUsed: true };
  }
  return { attach: true, nextFlatUsed: flatAlreadyUsed };
}
