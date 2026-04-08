import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  getDashboardStats,
  getTodayInstallments,
  getMonthlyStats,
  getMonthlyExpenseStats,
  getLowStockProducts,
  getWeeklySalesSummary,
} from '../lib/database';
import type {
  DashboardStats,
  TodayInstallment,
  MonthlyStat,
  MonthlyExpenseStat,
  LowStockProduct,
  WeeklySaleStat,
} from '../types';

interface DashboardData {
  stats: DashboardStats;
  pending: TodayInstallment[];
  monthly: MonthlyStat[];
  monthlyExp: MonthlyExpenseStat[];
  lowStock: LowStockProduct[];
  weekly: WeeklySaleStat[];
}

const INITIAL_STATS: DashboardStats = {
  totalClients: 0,
  overdueCount: 0,
  todayCount: 0,
  monthlyCollected: 0,
  lowStockCount: 0,
};

const INITIAL_DATA: DashboardData = {
  stats: INITIAL_STATS,
  pending: [],
  monthly: [],
  monthlyExp: [],
  lowStock: [],
  weekly: [],
};

export function useDashboard() {
  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const [stats, pending, monthly, monthlyExp, lowStock, weekly] = await Promise.all([
        getDashboardStats(),
        getTodayInstallments(),
        getMonthlyStats(),
        getMonthlyExpenseStats(),
        getLowStockProducts(),
        getWeeklySalesSummary(),
      ]);
      setData({
        stats,
        pending: pending as TodayInstallment[],
        monthly,
        monthlyExp,
        lowStock,
        weekly,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().then(() => { if (!active) return; });
      return () => { active = false; };
    }, [load])
  );

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { ...data, loading, refreshing, error, refresh };
}
