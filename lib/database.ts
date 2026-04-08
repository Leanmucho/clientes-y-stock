import { supabase } from './supabase';
import { Client, Sale, SaleItem, Installment, Product, ClientPayment, Expense, Supplier, TeamMember } from '../types';
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from './cache';

export const EXPENSE_CATEGORIES = ['Alquiler', 'Servicios', 'Stock/Compras', 'Personal', 'Transporte', 'Marketing', 'Impuestos', 'Otro'];
export const PAYMENT_METHODS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque'];

const TTL_SHORT = 30_000;   // 30s — dashboard, cobros
const TTL_LONG  = 120_000;  // 2min — clients, products lists

export async function initDatabase() {
  await markOverdueInstallments();
}

// --- CLIENTS ---
export async function getClients(): Promise<Client[]> {
  const cached = cacheGet<Client[]>('clients', TTL_LONG);
  if (cached) return cached;
  const { data } = await supabase.from('clients').select('*').order('name');
  const result = (data ?? []) as Client[];
  cacheSet('clients', result);
  return result;
}

export async function getClient(id: number): Promise<Client | null> {
  const { data } = await supabase.from('clients').select('*').eq('id', id).single();
  return data as Client | null;
}

export async function createClient(data: Omit<Client, 'id' | 'created_at'>): Promise<number> {
  const { data: row, error } = await supabase.from('clients').insert(data).select('id').single();
  if (error) throw error;
  cacheInvalidate('clients');
  return (row as any).id;
}

export async function updateClient(id: number, data: Omit<Client, 'id' | 'created_at'>) {
  await supabase.from('clients').update(data).eq('id', id);
  cacheInvalidate('clients', `client-${id}`);
}

export async function deleteClient(id: number) {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw new Error(`Error al eliminar cliente: ${error.message}`);
  cacheInvalidate('clients', `client-${id}`);
  cacheInvalidatePrefix(`sales-client-${id}`);
}

// --- PRODUCTS ---
export async function getProducts(): Promise<Product[]> {
  const cached = cacheGet<Product[]>('products', TTL_LONG);
  if (cached) return cached;
  const { data } = await supabase.from('products').select('*').order('name');
  const result = (data ?? []) as Product[];
  cacheSet('products', result);
  return result;
}

export async function getProduct(id: number): Promise<Product | null> {
  const { data } = await supabase.from('products').select('*').eq('id', id).single();
  return data as Product | null;
}

export async function createProduct(data: Omit<Product, 'id' | 'created_at'>): Promise<number> {
  const { data: row, error } = await supabase.from('products').insert(data).select('id').single();
  if (error) throw error;
  cacheInvalidate('products');
  return (row as any).id;
}

export async function updateProduct(id: number, data: Partial<Omit<Product, 'id' | 'created_at'>>) {
  await supabase.from('products').update(data).eq('id', id);
  cacheInvalidate('products', `product-${id}`);
}

export async function deleteProduct(id: number) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(`Error al eliminar producto: ${error.message}`);
  cacheInvalidate('products', `product-${id}`);
}

export async function adjustStock(productId: number, delta: number) {
  await supabase.rpc('adjust_stock', { product_id: productId, delta });
}

// --- SALES ---
export async function getSalesByClient(clientId: number): Promise<Sale[]> {
  const key = `sales-client-${clientId}`;
  const cached = cacheGet<Sale[]>(key, TTL_SHORT);
  if (cached) return cached;
  const { data } = await supabase
    .from('sales')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  const result = (data ?? []) as Sale[];
  cacheSet(key, result);
  return result;
}

export async function getSale(id: number): Promise<Sale | null> {
  const { data } = await supabase
    .from('sales')
    .select('*, clients(name)')
    .eq('id', id)
    .single();
  if (!data) return null;
  const row = data as any;
  return { ...row, client_name: row.clients?.name } as Sale;
}

export async function getSaleItems(saleId: number): Promise<SaleItem[]> {
  const { data } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', saleId)
    .order('id');
  return (data ?? []) as SaleItem[];
}

export async function createSale(
  data: Omit<Sale, 'id' | 'created_at' | 'client_name' | 'items'>,
  items: { product_id: number | null; product_name: string; quantity: number; unit_price: number }[]
): Promise<number> {
  const payload = {
    ...data,
    delivery_date: data.delivery_date?.trim() || null,
    start_date: data.start_date?.trim() || new Date().toISOString().split('T')[0],
    notes: data.notes ?? '',
  };

  const { data: row, error } = await supabase.from('sales').insert(payload).select('id').single();
  if (error) throw new Error(`Error al guardar la venta: ${error.message}`);
  const saleId = (row as any).id;

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(items.map(it => ({ ...it, sale_id: saleId })));
    if (itemsError) throw new Error(`Error al guardar los productos: ${itemsError.message}`);

    for (const it of items) {
      if (it.product_id) {
        await supabase.rpc('adjust_stock', { product_id: it.product_id, delta: -it.quantity });
      }
    }
  }

  cacheInvalidatePrefix(`sales-client-${data.client_id}`);
  cacheInvalidate('products');
  return saleId;
}

export async function updateSale(id: number, data: { notes?: string; payment_day?: number; installment_amount?: number }) {
  const { error } = await supabase.from('sales').update(data).eq('id', id);
  if (error) throw new Error(`Error al actualizar venta: ${error.message}`);
}

export async function deleteSale(id: number) {
  const { error } = await supabase.from('sales').delete().eq('id', id);
  if (error) throw new Error(`Error al eliminar venta: ${error.message}`);
  cacheInvalidatePrefix('sales-client-');
}

// --- ADVANCE PAYMENTS ---
export async function getClientPayments(clientId: number): Promise<ClientPayment[]> {
  const { data } = await supabase
    .from('client_payments')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });
  return (data ?? []) as ClientPayment[];
}

export async function getClientPendingDebt(clientId: number): Promise<number> {
  const { data: sales } = await supabase.from('sales').select('id').eq('client_id', clientId);
  const saleIds = (sales ?? []).map((s: any) => s.id);
  if (saleIds.length === 0) return 0;
  const { data } = await supabase
    .from('installments')
    .select('expected_amount, paid_amount')
    .in('sale_id', saleIds)
    .in('status', ['pending', 'partial', 'overdue']);
  return ((data ?? []) as any[]).reduce((acc, i) => acc + (i.expected_amount - i.paid_amount), 0);
}

export async function registerAdvancePayment(
  clientId: number,
  amount: number,
  date: string,
  notes: string
) {
  const { error } = await supabase.from('client_payments').insert({
    client_id: clientId, amount, date, notes,
  });
  if (error) throw new Error(`Error al registrar pago: ${error.message}`);

  const { data: sales } = await supabase.from('sales').select('id').eq('client_id', clientId);
  const saleIds = (sales ?? []).map((s: any) => s.id);
  if (saleIds.length === 0) return;

  const { data: installments } = await supabase
    .from('installments')
    .select('id, expected_amount, paid_amount')
    .in('sale_id', saleIds)
    .in('status', ['pending', 'partial', 'overdue'])
    .order('due_date');

  let remaining = amount;
  for (const inst of (installments ?? []) as any[]) {
    if (remaining <= 0) break;
    const stillOwed = inst.expected_amount - inst.paid_amount;
    const applying = Math.min(remaining, stillOwed);
    const newPaid = inst.paid_amount + applying;
    const newStatus = newPaid >= inst.expected_amount ? 'paid' : 'partial';
    await supabase
      .from('installments')
      .update({ paid_amount: newPaid, paid_date: date, status: newStatus })
      .eq('id', inst.id);
    remaining -= applying;
  }
}

// --- INSTALLMENTS ---
export async function getInstallmentsBySale(saleId: number): Promise<Installment[]> {
  const { data } = await supabase
    .from('installments')
    .select('*')
    .eq('sale_id', saleId)
    .order('installment_number');
  return (data ?? []) as Installment[];
}

export async function createInstallments(installments: Omit<Installment, 'id'>[]) {
  const { error } = await supabase.from('installments').insert(installments);
  if (error) throw new Error(`Error al crear cuotas: ${error.message}`);
}

export async function registerPayment(
  installmentId: number,
  paidAmount: number,
  paidDate: string,
  notes: string
) {
  const { data: inst } = await supabase
    .from('installments')
    .select('expected_amount')
    .eq('id', installmentId)
    .single();
  if (!inst) return;

  let status: Installment['status'];
  if (paidAmount <= 0) status = 'pending';
  else if (paidAmount >= (inst as any).expected_amount) status = 'paid';
  else status = 'partial';

  // Always set paid_date when payment is recorded; fall back to today if not provided
  const today = new Date().toISOString().split('T')[0];
  const resolvedPaidDate = paidAmount > 0 ? (paidDate || today) : null;

  const { error } = await supabase
    .from('installments')
    .update({ paid_amount: paidAmount, paid_date: resolvedPaidDate, status, notes })
    .eq('id', installmentId);
  if (error) throw new Error(`Error al registrar pago: ${error.message}`);
}

// --- CLIENT EXPORT ---
export async function getClientDataForExport(clientId: number) {
  const [clientRes, salesRes, paymentsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).single(),
    supabase.from('sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
    supabase.from('client_payments').select('*').eq('client_id', clientId).order('date', { ascending: false }),
  ]);

  const saleIds = ((salesRes.data ?? []) as any[]).map((s) => s.id);
  let installments: any[] = [];
  if (saleIds.length > 0) {
    const { data } = await supabase
      .from('installments')
      .select('*, sales(product_name)')
      .in('sale_id', saleIds)
      .order('due_date');
    installments = (data ?? []).map((i: any) => ({
      ...i,
      product_name: i.sales?.product_name ?? '',
      sales: undefined,
    }));
  }

  return {
    client: clientRes.data,
    sales: salesRes.data ?? [],
    installments,
    payments: paymentsRes.data ?? [],
  };
}

// --- DASHBOARD ---
export async function markOverdueInstallments() {
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('installments')
    .update({ status: 'overdue' })
    .lt('due_date', today)
    .in('status', ['pending', 'partial']);
}

export async function getTodayInstallments(): Promise<
  (Installment & { client_name: string; product_name: string; sale_id: number })[]
> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('installments')
    .select('*, sales(product_name, client_id, clients(name))')
    .lte('due_date', today)
    .in('status', ['pending', 'partial', 'overdue'])
    .order('due_date');
  return ((data ?? []) as any[]).map((i) => ({
    ...i,
    client_name: i.sales?.clients?.name ?? '',
    product_name: i.sales?.product_name ?? '',
  }));
}

export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

  const [clientsRes, overdueRes, todayRes, collectedRes, lowStockRes] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('installments').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
    supabase.from('installments').select('id', { count: 'exact', head: true }).eq('due_date', today).in('status', ['pending', 'partial', 'overdue']),
    supabase.from('installments').select('paid_amount').gte('paid_date', monthStart).lt('paid_date', nextMonthStart),
    supabase.from('products').select('id', { count: 'exact', head: true }).gt('min_stock', 0).filter('stock', 'lte', 'min_stock'),
  ]);

  const monthlyCollected = ((collectedRes.data ?? []) as any[]).reduce(
    (acc, r) => acc + (r.paid_amount ?? 0), 0
  );

  return {
    totalClients: clientsRes.count ?? 0,
    overdueCount: overdueRes.count ?? 0,
    todayCount: todayRes.count ?? 0,
    monthlyCollected,
    lowStockCount: lowStockRes.count ?? 0,
  };
}

export async function getOverallStats() {
  const [salesRes, installmentsRes, pendingRes] = await Promise.all([
    supabase.from('sales').select('total_amount, advance_payment'),
    supabase.from('installments').select('paid_amount').eq('status', 'paid'),
    supabase.from('installments').select('expected_amount, paid_amount').in('status', ['pending', 'partial', 'overdue']),
  ]);

  const totalSold = ((salesRes.data ?? []) as any[]).reduce((acc, s) => acc + s.total_amount, 0);
  const totalCollected = ((installmentsRes.data ?? []) as any[]).reduce((acc, i) => acc + i.paid_amount, 0);
  const totalPending = ((pendingRes.data ?? []) as any[]).reduce(
    (acc, i) => acc + (i.expected_amount - i.paid_amount), 0
  );
  return { totalSold, totalCollected, totalPending };
}

export async function getMonthlyStats(): Promise<{ month: string; collected: number }[]> {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];

  // Fetch paid installments: those with paid_date in range, plus those with null paid_date
  // (historical data may lack paid_date — use due_date as fallback)
  const [withDate, withoutDate] = await Promise.all([
    supabase
      .from('installments')
      .select('paid_date, due_date, paid_amount')
      .gte('paid_date', fromDate)
      .not('paid_date', 'is', null),
    supabase
      .from('installments')
      .select('paid_date, due_date, paid_amount')
      .eq('status', 'paid')
      .is('paid_date', null)
      .gte('due_date', fromDate),
  ]);

  const byMonth: Record<string, number> = {};
  const addRow = (row: { paid_date: string | null; due_date: string | null; paid_amount: number | null }) => {
    const dateKey = row.paid_date ?? row.due_date;
    if (!dateKey) return;
    const month = dateKey.substring(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + (row.paid_amount ?? 0);
  };

  for (const row of (withDate.data ?? []) as { paid_date: string | null; due_date: string | null; paid_amount: number | null }[]) {
    addRow(row);
  }
  for (const row of (withoutDate.data ?? []) as { paid_date: string | null; due_date: string | null; paid_amount: number | null }[]) {
    addRow(row);
  }

  const results: { month: string; collected: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toISOString().substring(0, 7);
    results.push({ month, collected: byMonth[month] ?? 0 });
  }
  return results;
}

// --- ZONES / ROUTES ---
export async function getTodayPendingByZone(): Promise<
  { zone: string; clients: { client_id: number; client_name: string; address: string; phone: string; installment_id: number; expected_amount: number; paid_amount: number; due_date: string; status: string; sale_id: number }[] }[]
> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('installments')
    .select('id, expected_amount, paid_amount, due_date, status, sale_id, sales(client_id, clients(name, address, phone, zone))')
    .lte('due_date', today)
    .in('status', ['pending', 'partial', 'overdue'])
    .order('due_date');

  const byZone: Record<string, any[]> = {};
  for (const inst of (data ?? []) as any[]) {
    const client = inst.sales?.clients;
    if (!client) continue;
    const zone = client.zone?.trim() || 'Sin zona';
    if (!byZone[zone]) byZone[zone] = [];
    byZone[zone].push({
      client_id: inst.sales.client_id,
      client_name: client.name,
      address: client.address,
      phone: client.phone,
      installment_id: inst.id,
      sale_id: inst.sale_id,
      expected_amount: inst.expected_amount,
      paid_amount: inst.paid_amount,
      due_date: inst.due_date,
      status: inst.status,
    });
  }
  return Object.entries(byZone)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, clients]) => ({ zone, clients }));
}

export async function getClientsByZone(): Promise<{ zone: string; clients: Client[] }[]> {
  const { data } = await supabase.from('clients').select('*').order('name');
  const clients = (data ?? []) as Client[];
  const byZone: Record<string, Client[]> = {};
  for (const c of clients) {
    const zone = c.zone?.trim() || 'Sin zona';
    if (!byZone[zone]) byZone[zone] = [];
    byZone[zone].push(c);
  }
  return Object.entries(byZone)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, clients]) => ({ zone, clients }));
}

// --- EXPENSES ---
export async function getExpenses(): Promise<Expense[]> {
  const { data } = await supabase
    .from('expenses')
    .select('*, suppliers(name)')
    .order('date', { ascending: false });
  return ((data ?? []) as any[]).map(e => ({
    ...e,
    supplier_name: e.suppliers?.name ?? null,
    suppliers: undefined,
  })) as Expense[];
}

export async function getExpensesByMonth(month: string): Promise<Expense[]> {
  const { data } = await supabase
    .from('expenses')
    .select('*, suppliers(name)')
    .like('date', `${month}%`)
    .order('date', { ascending: false });
  return ((data ?? []) as any[]).map(e => ({
    ...e,
    supplier_name: e.suppliers?.name ?? null,
    suppliers: undefined,
  })) as Expense[];
}

export async function createExpense(data: Omit<Expense, 'id' | 'created_at' | 'supplier_name'>): Promise<number> {
  const { data: row, error } = await supabase.from('expenses').insert(data).select('id').single();
  if (error) throw new Error(`Error al guardar gasto: ${error.message}`);
  return (row as any).id;
}

export async function updateExpense(id: number, data: Partial<Omit<Expense, 'id' | 'created_at' | 'supplier_name'>>) {
  const { error } = await supabase.from('expenses').update(data).eq('id', id);
  if (error) throw new Error(`Error al actualizar gasto: ${error.message}`);
}

export async function deleteExpense(id: number) {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw new Error(`Error al eliminar gasto: ${error.message}`);
}

export async function getMonthlyExpenseStats(): Promise<{ month: string; amount: number }[]> {
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
  const { data } = await supabase.from('expenses').select('date, amount').gte('date', fromDate);
  const byMonth: Record<string, number> = {};
  for (const row of (data ?? []) as any[]) {
    if (!row.date) continue;
    const month = row.date.substring(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + (row.amount ?? 0);
  }
  const results: { month: string; amount: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toISOString().substring(0, 7);
    results.push({ month, amount: byMonth[month] ?? 0 });
  }
  return results;
}

// --- SUPPLIERS ---
export async function getSuppliers(): Promise<Supplier[]> {
  const { data } = await supabase.from('suppliers').select('*').order('name');
  return (data ?? []) as Supplier[];
}

export async function getSupplier(id: number): Promise<Supplier | null> {
  const { data } = await supabase.from('suppliers').select('*').eq('id', id).single();
  return data as Supplier | null;
}

export async function createSupplier(data: Omit<Supplier, 'id' | 'created_at'>): Promise<number> {
  const { data: row, error } = await supabase.from('suppliers').insert(data).select('id').single();
  if (error) throw new Error(`Error al guardar proveedor: ${error.message}`);
  return (row as any).id;
}

export async function updateSupplier(id: number, data: Partial<Omit<Supplier, 'id' | 'created_at'>>) {
  const { error } = await supabase.from('suppliers').update(data).eq('id', id);
  if (error) throw new Error(`Error al actualizar proveedor: ${error.message}`);
}

export async function deleteSupplier(id: number) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw new Error(`Error al eliminar proveedor: ${error.message}`);
}

export async function getExpensesBySupplier(supplierId: number): Promise<Expense[]> {
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('date', { ascending: false });
  return (data ?? []) as Expense[];
}

// --- TEAM MEMBERS ---
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data } = await supabase.from('team_members').select('*').order('name');
  return (data ?? []) as TeamMember[];
}

export async function createTeamMember(data: Omit<TeamMember, 'id' | 'created_at'>): Promise<number> {
  const { data: row, error } = await supabase.from('team_members').insert(data).select('id').single();
  if (error) throw new Error(`Error al guardar miembro: ${error.message}`);
  return (row as any).id;
}

export async function updateTeamMember(id: number, data: Partial<Omit<TeamMember, 'id' | 'created_at'>>) {
  const { error } = await supabase.from('team_members').update(data).eq('id', id);
  if (error) throw new Error(`Error al actualizar miembro: ${error.message}`);
}

export async function deleteTeamMember(id: number) {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw new Error(`Error al eliminar miembro: ${error.message}`);
}

// --- BUSINESS ANALYTICS ---
export async function getBusinessAnalytics() {
  const now = new Date();

  // DATE range for current month (paid_date / expense date columns — DATE type)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = thisMonthStart;

  // TIMESTAMPTZ range for created_at columns (sales, clients)
  const thisMonthStartTs = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthEndTs = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [
    colThis, colThisNullDate,
    colLast, colLastNullDate,
    expThis, expLast, expByCat,
    salesCount, clientsCount,
  ] = await Promise.all([
    // Installments with explicit paid_date in this/last month
    supabase.from('installments').select('paid_amount')
      .gte('paid_date', thisMonthStart).lt('paid_date', thisMonthEnd),
    // Installments with null paid_date (historical) — use due_date as fallback for this month
    supabase.from('installments').select('paid_amount')
      .eq('status', 'paid').is('paid_date', null)
      .gte('due_date', thisMonthStart).lt('due_date', thisMonthEnd),
    supabase.from('installments').select('paid_amount')
      .gte('paid_date', lastMonthStart).lt('paid_date', lastMonthEnd),
    supabase.from('installments').select('paid_amount')
      .eq('status', 'paid').is('paid_date', null)
      .gte('due_date', lastMonthStart).lt('due_date', lastMonthEnd),
    supabase.from('expenses').select('amount')
      .gte('date', thisMonthStart).lt('date', thisMonthEnd),
    supabase.from('expenses').select('amount')
      .gte('date', lastMonthStart).lt('date', lastMonthEnd),
    supabase.from('expenses').select('category, amount')
      .gte('date', thisMonthStart).lt('date', thisMonthEnd),
    supabase.from('sales').select('id', { count: 'exact', head: true })
      .gte('created_at', thisMonthStartTs).lt('created_at', thisMonthEndTs),
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .gte('created_at', thisMonthStartTs).lt('created_at', thisMonthEndTs),
  ]);

  function sum(data: { [key: string]: number }[] | null, key: string): number {
    return (data ?? []).reduce((acc, r) => acc + (r[key] ?? 0), 0);
  }

  const thisCollected =
    sum(colThis.data as { paid_amount: number }[] | null, 'paid_amount') +
    sum(colThisNullDate.data as { paid_amount: number }[] | null, 'paid_amount');
  const lastCollected =
    sum(colLast.data as { paid_amount: number }[] | null, 'paid_amount') +
    sum(colLastNullDate.data as { paid_amount: number }[] | null, 'paid_amount');
  const thisExpenses = sum(expThis.data as { amount: number }[] | null, 'amount');
  const lastExpenses = sum(expLast.data as { amount: number }[] | null, 'amount');

  const byCategory: Record<string, number> = {};
  for (const e of (expByCat.data ?? []) as { category: string; amount: number }[]) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  return {
    thisMonth: {
      collected: thisCollected,
      expenses: thisExpenses,
      net: thisCollected - thisExpenses,
    },
    lastMonth: {
      collected: lastCollected,
      expenses: lastExpenses,
      net: lastCollected - lastExpenses,
    },
    newSalesThisMonth: salesCount.count ?? 0,
    newClientsThisMonth: clientsCount.count ?? 0,
    expensesByCategory: Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({ category, amount })),
  };
}

// --- EXPORT ---
export async function exportAllData() {
  const [clients, products, sales, saleItems, installments] = await Promise.all([
    supabase.from('clients').select('*').order('name'),
    supabase.from('products').select('*').order('name'),
    supabase.from('sales').select('*').order('created_at', { ascending: false }),
    supabase.from('sale_items').select('*').order('sale_id'),
    supabase.from('installments').select('*, sales(product_name, clients(name))').order('due_date'),
  ]);

  return {
    exported_at: new Date().toISOString(),
    app: 'Clientes y Stock',
    clients: clients.data ?? [],
    products: products.data ?? [],
    sales: sales.data ?? [],
    sale_items: saleItems.data ?? [],
    installments: ((installments.data ?? []) as any[]).map(i => ({
      ...i,
      client_name: i.sales?.clients?.name ?? '',
      product_name: i.sales?.product_name ?? '',
      sales: undefined,
    })),
  };
}

// --- BULK STOCK IMPORT ---
export async function bulkUpdateStockByName(
  rows: { name: string; stock: number }[]
): Promise<{ updated: number; notFound: string[] }> {
  const { data: products } = await supabase.from('products').select('id, name');
  const productMap = new Map<string, number>();
  for (const p of (products ?? []) as { id: number; name: string }[]) {
    productMap.set(p.name.toLowerCase().trim(), p.id);
  }

  let updated = 0;
  const notFound: string[] = [];

  for (const row of rows) {
    const key = row.name.toLowerCase().trim();
    const id = productMap.get(key);
    if (!id) { notFound.push(row.name); continue; }
    const { error } = await supabase.from('products').update({ stock: row.stock }).eq('id', id);
    if (!error) updated++;
  }

  cacheInvalidatePrefix('products');
  return { updated, notFound };
}

// --- EXPORT HELPERS ---
export async function getSalesExport() {
  const { data } = await supabase
    .from('sales')
    .select('id, created_at, total_amount, paid_amount, status, product_name, notes, clients(name)')
    .order('created_at', { ascending: false });
  return ((data ?? []) as any[]).map(s => ({
    id: s.id,
    fecha: s.created_at?.split('T')[0] ?? '',
    cliente: s.clients?.name ?? '',
    producto: s.product_name ?? '',
    total: s.total_amount,
    pagado: s.paid_amount,
    estado: s.status,
    notas: s.notes ?? '',
  }));
}

export async function getDebtorsExport() {
  const { data } = await supabase
    .from('clients')
    .select('id, name, phone, zone, sales(total_amount, paid_amount, status)')
    .order('name');
  return ((data ?? []) as any[])
    .map(c => {
      const sales = (c.sales ?? []) as any[];
      const debt = sales
        .filter((s: any) => s.status !== 'paid')
        .reduce((acc: number, s: any) => acc + (s.total_amount - s.paid_amount), 0);
      return { nombre: c.name, telefono: c.phone ?? '', zona: c.zone ?? '', deuda: debt };
    })
    .filter(c => c.deuda > 0)
    .sort((a, b) => b.deuda - a.deuda);
}

export async function getInventoryExport() {
  const { data } = await supabase
    .from('products')
    .select('name, description, price, stock, min_stock, categories(name)')
    .order('name');
  return ((data ?? []) as any[]).map(p => ({
    nombre: p.name,
    descripcion: p.description ?? '',
    precio: p.price,
    stock: p.stock,
    stock_minimo: p.min_stock,
    categoria: (p.categories as any)?.name ?? '',
    estado: p.stock === 0 ? 'Sin stock' : p.stock <= p.min_stock ? 'Stock bajo' : 'OK',
  }));
}

export async function getLowStockProducts(limit = 10): Promise<
  { id: number; name: string; stock: number; min_stock: number; price: number }[]
> {
  const { data } = await supabase
    .from('products')
    .select('id, name, stock, min_stock, price')
    .gt('min_stock', 0)
    .order('stock', { ascending: true })
    .limit(limit);
  return ((data ?? []) as { id: number; name: string; stock: number; min_stock: number; price: number }[])
    .filter((p) => p.stock <= p.min_stock);
}

export async function getWeeklySalesSummary(): Promise<
  { day: string; label: string; total: number }[]
> {
  const now = new Date();
  const days: { day: string; label: string; total: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('es-AR', { weekday: 'short' });
    days.push({ day: iso, label, total: 0 });
  }

  const fromDate = days[0].day;
  const { data } = await supabase
    .from('installments')
    .select('paid_date, paid_amount')
    .gte('paid_date', fromDate)
    .eq('status', 'paid');

  for (const row of (data ?? []) as { paid_date: string | null; paid_amount: number }[]) {
    if (!row.paid_date) continue;
    const entry = days.find((d) => d.day === row.paid_date);
    if (entry) entry.total += row.paid_amount ?? 0;
  }

  return days;
}
