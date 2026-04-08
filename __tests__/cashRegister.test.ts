jest.mock('../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

import {
  computeCashDifference,
  isCashSurplus,
  formatCashDifferenceSummary,
} from '../services/cashRegister';
import type { CashSummary } from '../types';

describe('computeCashDifference', () => {
  it('returns positive when collected > expected', () => {
    expect(computeCashDifference(15000, 10000)).toBe(5000);
  });

  it('returns negative when collected < expected', () => {
    expect(computeCashDifference(8000, 10000)).toBe(-2000);
  });

  it('returns zero when equal', () => {
    expect(computeCashDifference(10000, 10000)).toBe(0);
  });

  it('handles zero collected', () => {
    expect(computeCashDifference(0, 5000)).toBe(-5000);
  });

  it('handles zero expected', () => {
    expect(computeCashDifference(3000, 0)).toBe(3000);
  });
});

describe('isCashSurplus', () => {
  it('returns true for positive difference', () => {
    expect(isCashSurplus(1000)).toBe(true);
  });

  it('returns true for zero difference', () => {
    expect(isCashSurplus(0)).toBe(true);
  });

  it('returns false for negative difference', () => {
    expect(isCashSurplus(-500)).toBe(false);
  });
});

describe('formatCashDifferenceSummary', () => {
  const baseSummary: CashSummary = {
    date: '2024-03-15',
    expectedCash: 10000,
    collectedCash: 12000,
    difference: 2000,
    surplus: true,
    breakdown: [],
  };

  it('shows Sobrante for surplus', () => {
    const result = formatCashDifferenceSummary(baseSummary);
    expect(result).toContain('Sobrante');
    expect(result).toContain('2.000');
  });

  it('shows Faltante for deficit', () => {
    const deficit: CashSummary = {
      ...baseSummary,
      collectedCash: 8000,
      difference: -2000,
      surplus: false,
    };
    const result = formatCashDifferenceSummary(deficit);
    expect(result).toContain('Faltante');
    expect(result).toContain('2.000');
  });

  it('shows zero correctly', () => {
    const zero: CashSummary = { ...baseSummary, difference: 0, surplus: true };
    const result = formatCashDifferenceSummary(zero);
    expect(result).toContain('Sobrante');
    expect(result).toContain('0');
  });

  it('formats large numbers with dots', () => {
    const large: CashSummary = { ...baseSummary, difference: 150000, surplus: true };
    const result = formatCashDifferenceSummary(large);
    expect(result).toContain('150.000');
  });
});

describe('cash register calculations', () => {
  it('correctly computes net from breakdown items', () => {
    const breakdown = [
      { clientName: 'Ana', amount: 5000, installmentNumber: 1 },
      { clientName: 'Carlos', amount: 3000, installmentNumber: 2 },
      { clientName: 'María', amount: 7000, installmentNumber: 1 },
    ];
    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBe(15000);
  });

  it('correctly identifies deficit scenario', () => {
    const collected = 8000;
    const expected = 12000;
    const diff = computeCashDifference(collected, expected);
    expect(isCashSurplus(diff)).toBe(false);
    expect(Math.abs(diff)).toBe(4000);
  });
});
