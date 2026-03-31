export interface Client {
  id: number;
  name: string;
  dni: string;
  phone: string;
  address: string;
  reference: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  min_stock: number;
  created_at: string;
}

export interface Sale {
  id: number;
  client_id: number;
  client_name?: string;
  product_id?: number | null;
  product_name: string;
  total_amount: number;
  advance_payment: number;
  installments_count: number;
  installment_amount: number;
  payment_day: number;
  start_date: string;
  delivery_date: string;
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
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  notes: string;
}
