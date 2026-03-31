import { supabase } from './supabase';
import { Client, Sale, Installment, Product } from '../types';

export async function initDatabase() {
  await markOverdueInstallments();
}

// --- CLIENTS ---
export async function getClients(): Promise<Client[]> {
  const { data } = await supabase.from('clients').select('*').order('name');
  return (data ?? []) as Client[];
}

export async function getClient(id: number): Promise<Client | null> {
  const { data } = await supabase.from('clients').select('*').eq('id', id).single();
  return data as Client | null;
}

export async function createClient(data: Omit<Client, 'id' | 'created_at'>): Promise<number> {
  const { data: row } = await supabase.from('clients').insert(data).select('id').single();
  return (row as any).id;
}

export async function updateClient(id: number, data: Omit<Client, 'id' | 'created_at'>) {
  await supabase.from('clients').update(data).eq('id', id);
}

// --- PRODUCTS ---
export async function getProducts(): Promise<Product[]> {
  const { data } = await supabase.from('products').select('*').order('name');
  return (data ?? []) as Product[];
}

export async function getProduct(id: number): Promise<Product | null> {
  const { data } = await supabase.from('products').select('*').eq('id', id).single();
  return data as Product | null;
}

export async function createProduct(data: Omit<Product, 'id' | 'created_at'>): Promise<number> {
  const { data: row } = await supabase.from('products').insert(data).select('id').single();
  return (row as any).id;
}

export async function updateProduct(id: number, data: Partial<Omit<Product, 'id' | 'created_at'>>) {
  await supabase.from('products').update(data).eq('id', id);
}

export async function adjustStock(productId: number, delta: number) {
  await supabase.rpc('adjust_stock', { product_id: productId, delta });
}

// --- SALES ---
export async function getSalesByClient(clientId: number): Promise<Sale[]> {
  const { data } = await supabase
    .from('sales')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Sale[];
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

export async function createSale(
  data: Omit<Sale, 'id' | 'created_at' | 'client_name'>
): Promise<number> {
  const { product_id, ...rest } = data;
  const payload = { ...rest, product_id: product_id ?? null };
  const { data: row } = await supabase.from('sales').insert(payload).select('id').single();
  // decrement stock if product linked
  if (product_id) {
    await supabase
      .from('products')
      .select('stock')
      .eq('id', product_id)
      .single()
      .then(async ({ data: p }) => {
        if (p) {
          await supabase
            .from('products')
            .update({ stock: Math.max(0, (p as any).stock - 1) })
            .eq('id', product_id);
        }
      });
  }
  return (row as any).id;
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
  await supabase.from('installments').insert(installments);
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

  await supabase
    .from('installments')
    .update({ paid_amount: paidAmount, paid_date: paidDate || null, status, notes })
    .eq('id', installmentId);
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
  const thisMonth = today.substring(0, 7);

  const [clientsRes, overdueRes, todayRes, collectedRes, lowStockRes] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase
      .from('installments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'overdue'),
    supabase
      .from('installments')
      .select('id', { count: 'exact', head: true })
      .eq('due_date', today)
      .in('status', ['pending', 'partial', 'overdue']),
    supabase
      .from('installments')
      .select('paid_amount')
      .like('paid_date', `${thisMonth}%`),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .gt('min_stock', 0)
      .filter('stock', 'lte', 'min_stock'),
  ]);

  const monthlyCollected = ((collectedRes.data ?? []) as any[]).reduce(
    (acc, r) => acc + (r.paid_amount ?? 0),
    0
  );

  return {
    totalClients: clientsRes.count ?? 0,
    overdueCount: overdueRes.count ?? 0,
    todayCount: todayRes.count ?? 0,
    monthlyCollected,
    lowStockCount: lowStockRes.count ?? 0,
  };
}
