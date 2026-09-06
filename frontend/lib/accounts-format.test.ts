import { describe, expect, it } from 'vitest';
import {
  accountNo,
  isArchived,
  money,
  moneyPlain,
  phaseLabel,
  sizeLabel,
  statusClass,
  typeLabel,
} from './accounts-format';

describe('accounts-format (unit / edge)', () => {
  it('formats account sizes', () => {
    expect(sizeLabel(100_000)).toBe('$100k');
    expect(sizeLabel(500)).toBe('$500');
  });

  it('formats signed money including negatives', () => {
    expect(money(12.5)).toContain('12.50');
    expect(money(-3)).toMatch(/-/);
  });

  it('does not throw on undefined/null equity (payouts request bug)', () => {
    expect(moneyPlain(undefined)).toBe('$0.00');
    expect(moneyPlain(null)).toBe('$0.00');
    expect(money(undefined as unknown as number)).toBe('$0.00');
  });

  it('maps sku fragments to challenge types', () => {
    expect(typeLabel('two_step_flex_50k')).toBe('2 Step');
    expect(typeLabel('one-step-pro')).toBe('1 Step');
    expect(typeLabel('zero_standard')).toBe('Zero');
  });

  it('labels funded vs phase', () => {
    expect(phaseLabel({ status: 'Funded', currentPhase: 3, phases: 2 })).toBe('Funded');
    expect(phaseLabel({ status: 'Active', currentPhase: 1, phases: 2 })).toBe('Phase 1');
  });

  it('detects archived statuses', () => {
    expect(isArchived('Failed')).toBe(true);
    expect(isArchived('Active')).toBe(false);
  });

  it('falls back account number to id prefix (edge)', () => {
    expect(accountNo({ id: 'abcdefghijk', sku: 'x', status: 'Active', accountSize: 5, currentPhase: 1, phases: 2 })).toBe(
      'abcdefghi',
    );
    expect(
      accountNo({
        id: 'abcdefghijk',
        sku: 'x',
        status: 'Active',
        accountSize: 5,
        currentPhase: 1,
        phases: 2,
        login: '80001234',
      }),
    ).toBe('80001234');
  });

  it('returns status pill classes', () => {
    expect(statusClass('Funded')).toContain('ok');
    expect(statusClass('Failed')).toContain('bad');
  });
});
