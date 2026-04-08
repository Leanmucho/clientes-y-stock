export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface Client {
  id: number;
  name: string;
  dni: string;
  phone: string;
  address: string;
  reference: string;
  zone: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  min_stock: number;
  image_url: string;
  category_id: number | null;
  category_name?: string;
  barcode?: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export type InstallmentFrequency = 'weekly' | 'biweekly' | 'monthly';
export type InstallmentStatus = 'pending' | 'partial' | 'paid' | 'overdue';
export type SaleStatus = 'active' | 'completed' | 'cancelled';

export interface Sale {
  id: number;
  client_id: number;
  client_name?: string;
  product_name: string;
  total_amount: number;
  advance_payment: number;
  paid_amount?: number;
  installments_count: number;
  installment_amount: number;
  installment_frequency: InstallmentFrequency;
  payment_day: number;
  start_date: string;
  delivery_date: string;
  notes: string;
  status?: SaleStatus;
  created_at: string;
  items?: SaleItem[];
}

export interface ClientPayment {
  id: number;
  client_id: number;
  amount: number;
  date: string;
  notes: string;
  created_at: string;
}

export interface Installment {
  id: number;
  sale_id: number;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  paid_date: string | null;
  status: InstallmentStatus;
  notes: string;
  created_at?: string;
}

export interface TodayInstallment extends Installment {
  client_name: string;
  product_name: string;
}

export interface Expense {
  id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  supplier_id: number | null;
  supplier_name?: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  category: string;
  notes: string;
  created_at: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  phone: string;
  commission_rate: number;
  active: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalClients: number;
  overdueCount: number;
  todayCount: number;
  monthlyCollected: number;
  lowStockCount: number;
}

export interface MonthlyStat {
  month: string;
  collected: number;
}

export interface MonthlyExpenseStat {
  month: string;
  amount: number;
}

export interface WeeklySaleStat {
  day: string;
  label: string;
  total: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  stock: number;
  min_stock: number;
  price: number;
}

export interface CashSummary {
  date: string;
  expectedCash: number;
  collectedCash: number;
  difference: number;
  surplus: boolean;
  breakdown: CashBreakdownItem[];
}

export interface CashBreakdownItem {
  clientName: string;
  amount: number;
  installmentNumber: number;
}

export interface ReceiptData {
  installment: Installment;
  sale: Sale;
  client: Client;
  paidAmount: number;
  paidDate: string;
}
