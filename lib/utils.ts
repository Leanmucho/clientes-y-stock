export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function addMonths(dateStr: string, months: number): string {
  const date = new Date(dateStr + 'T12:00:00');
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
}

export function generateInstallmentDates(
  startDate: string,
  paymentDay: number,
  count: number
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');

  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    d.setDate(paymentDay);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'paid': return 'Pagada';
    case 'partial': return 'Parcial';
    case 'overdue': return 'Vencida';
    default: return 'Pendiente';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'paid': return '#10B981';
    case 'partial': return '#F59E0B';
    case 'overdue': return '#EF4444';
    default: return '#6366F1';
  }
}
