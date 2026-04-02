// Formats raw digit string for display inside inputs (no $ prefix)
// e.g. "5000000" → "5.000.000"
export function formatInputNumber(digits: string): string {
  if (!digits) return '';
  const num = parseInt(digits);
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount);
  // Argentine format: dot as thousands separator, no decimals ($50.000)
  const withDots = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return '$' + withDots;
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
  // Fecha inválida (ej: usuario escribiendo a medias) → no crashear
  if (isNaN(start.getTime())) return [];

  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    d.setDate(paymentDay);
    // setDate puede producir overflow (ej: feb 31 → mar 3), corregir
    if (isNaN(d.getTime())) continue;
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
