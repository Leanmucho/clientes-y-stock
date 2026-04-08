import {
  generateInstallmentDates,
  formatCurrency,
  formatDate,
  addMonths,
  getTodayISO,
  getStatusLabel,
  getStatusColor,
} from '../lib/utils';

describe('generateInstallmentDates', () => {
  it('generates correct number of dates', () => {
    const dates = generateInstallmentDates('2024-01-01', 15, 6);
    expect(dates).toHaveLength(6);
  });

  it('sets correct payment day', () => {
    const dates = generateInstallmentDates('2024-01-01', 10, 3);
    dates.forEach((d) => {
      expect(d.split('-')[2]).toBe('10');
    });
  });

  it('increments months sequentially', () => {
    const dates = generateInstallmentDates('2024-01-01', 5, 4);
    expect(dates[0]).toContain('2024-02');
    expect(dates[1]).toContain('2024-03');
    expect(dates[2]).toContain('2024-04');
    expect(dates[3]).toContain('2024-05');
  });

  it('handles month overflow into next year', () => {
    const dates = generateInstallmentDates('2024-10-01', 15, 4);
    expect(dates[2]).toContain('2025-01');
    expect(dates[3]).toContain('2025-02');
  });

  it('returns ISO date strings', () => {
    const dates = generateInstallmentDates('2024-03-10', 20, 2);
    dates.forEach((d) => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('handles payment day 1', () => {
    const dates = generateInstallmentDates('2024-01-15', 1, 2);
    expect(dates[0]).toBe('2024-02-01');
    expect(dates[1]).toBe('2024-03-01');
  });

  it('returns empty array for count 0', () => {
    const dates = generateInstallmentDates('2024-01-01', 15, 0);
    expect(dates).toHaveLength(0);
  });
});

describe('formatCurrency', () => {
  it('formats integer amounts', () => {
    expect(formatCurrency(50000)).toBe('$50.000');
  });

  it('formats amounts with dots for thousands', () => {
    expect(formatCurrency(1000000)).toBe('$1.000.000');
  });

  it('rounds floating point values', () => {
    expect(formatCurrency(99.9)).toBe('$100');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('handles small amounts', () => {
    expect(formatCurrency(500)).toBe('$500');
  });
});

describe('formatDate', () => {
  it('converts ISO date to dd/mm/yyyy', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-');
  });

  it('pads single digit day and month', () => {
    expect(formatDate('2024-01-05')).toBe('05/01/2024');
  });
});

describe('addMonths', () => {
  it('adds months correctly', () => {
    expect(addMonths('2024-01-15', 3)).toBe('2024-04-15');
  });

  it('rolls over to next year', () => {
    expect(addMonths('2024-11-01', 3)).toBe('2025-02-01');
  });

  it('adds 0 months returns same date', () => {
    expect(addMonths('2024-06-10', 0)).toBe('2024-06-10');
  });
});

describe('getTodayISO', () => {
  it('returns a valid ISO date string', () => {
    const today = getTodayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches current date', () => {
    const today = getTodayISO();
    const now = new Date().toISOString().split('T')[0];
    expect(today).toBe(now);
  });
});

describe('getStatusLabel', () => {
  it('returns correct labels', () => {
    expect(getStatusLabel('paid')).toBe('Pagada');
    expect(getStatusLabel('partial')).toBe('Parcial');
    expect(getStatusLabel('overdue')).toBe('Vencida');
    expect(getStatusLabel('pending')).toBe('Pendiente');
    expect(getStatusLabel('unknown')).toBe('Pendiente');
  });
});

describe('getStatusColor', () => {
  it('returns hex colors for each status', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    expect(getStatusColor('paid')).toMatch(hexPattern);
    expect(getStatusColor('partial')).toMatch(hexPattern);
    expect(getStatusColor('overdue')).toMatch(hexPattern);
    expect(getStatusColor('pending')).toMatch(hexPattern);
  });

  it('returns different colors per status', () => {
    const colors = new Set([
      getStatusColor('paid'),
      getStatusColor('partial'),
      getStatusColor('overdue'),
      getStatusColor('pending'),
    ]);
    expect(colors.size).toBe(4);
  });
});
