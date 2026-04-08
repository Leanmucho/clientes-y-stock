import { supabase } from '../lib/supabase';
import { getTodayISO } from '../lib/utils';
import type { CashBreakdownItem, CashSummary } from '../types';

interface RawInstallmentRow {
  id: number;
  expected_amount: number;
  paid_amount: number;
  paid_date: string | null;
  status: string;
  installment_number: number;
  due_date: string;
  sales: {
    client_id: number;
    clients: { name: string } | null;
  } | null;
}

export async function closeCashRegister(date?: string): Promise<CashSummary> {
  const targetDate = date ?? getTodayISO();

  const { data: paidRows, error: paidError } = await supabase
    .from('installments')
    .select('id, expected_amount, paid_amount, paid_date, status, installment_number, sales(client_id, clients(name))')
    .eq('paid_date', targetDate)
    .eq('status', 'paid');

  if (paidError) throw new Error(`Error al obtener cobros: ${paidError.message}`);

  const { data: dueRows, error: dueError } = await supabase
    .from('installments')
    .select('id, expected_amount, paid_amount, status, due_date')
    .eq('due_date', targetDate)
    .in('status', ['pending', 'partial', 'overdue']);

  if (dueError) throw new Error(`Error al obtener vencimientos: ${dueError.message}`);

  const paid = (paidRows ?? []) as RawInstallmentRow[];
  const due = (dueRows ?? []) as Pick<RawInstallmentRow, 'id' | 'expected_amount' | 'paid_amount' | 'status' | 'due_date'>[];

  const collectedCash = paid.reduce((sum, row) => sum + (row.paid_amount ?? 0), 0);
  const expectedCash = due.reduce((sum, row) => sum + (row.expected_amount - (row.paid_amount ?? 0)), 0);
  const difference = collectedCash - expectedCash;

  const breakdown: CashBreakdownItem[] = paid.map((row) => ({
    clientName: row.sales?.clients?.name ?? `Cuota #${row.id}`,
    amount: row.paid_amount ?? 0,
    installmentNumber: row.installment_number,
  }));

  return {
    date: targetDate,
    expectedCash,
    collectedCash,
    difference,
    surplus: difference >= 0,
    breakdown,
  };
}

export function computeCashDifference(collected: number, expected: number): number {
  return collected - expected;
}

export function isCashSurplus(difference: number): boolean {
  return difference >= 0;
}

export function formatCashDifferenceSummary(summary: CashSummary): string {
  const sign = summary.difference >= 0 ? '+' : '';
  const status = summary.surplus ? 'Sobrante' : 'Faltante';
  return `${status}: ${sign}$${Math.round(Math.abs(summary.difference))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
