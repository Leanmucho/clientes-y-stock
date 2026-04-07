import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getDashboardStats, getTodayInstallments, getMonthlyStats,
  getMonthlyExpenseStats, markOverdueInstallments, getLowStockProducts,
} from '../../lib/database';
import { Product } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import { Loading } from '../../components/Loading';

type FilterStatus = 'all' | 'overdue' | 'pending' | 'partial';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalClients: 0, overdueCount: 0, todayCount: 0,
    monthlyCollected: 0, lowStockCount: 0, monthlySales: 0, todaySales: 0,
  });
  const [pending, setPending] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; collected: number }[]>([]);
  const [monthlyExp, setMonthlyExp] = useState<{ month: string; amount: number }[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showMonthly, setShowMonthly] = useState(false);

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    await markOverdueInstallments();
    const [s, p, m, me, lsp] = await Promise.all([
      getDashboardStats(), getTodayInstallments(), getMonthlyStats(),
      getMonthlyExpenseStats(), getLowStockProducts(),
    ]);
    const corrected = p.map((i: any) =>
      i.status === 'pending' && i.due_date < today ? { ...i, status: 'overdue' } : i
    );
    setStats(s); setPending(corrected); setMonthly(m); setMonthlyExp(me);
    setLowStockProducts(lsp); setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    markOverdueInstallments()
      .then(() => Promise.all([
        getDashboardStats(), getTodayInstallments(), getMonthlyStats(),
        getMonthlyExpenseStats(), getLowStockProducts(),
      ]))
      .then(([s, p, m, me, lsp]) => {
        if (!active) return;
        const corrected = p.map((i: any) =>
          i.status === 'pending' && i.due_date < today ? { ...i, status: 'overdue' } : i
        );
        setStats(s); setPending(corrected); setMonthly(m); setMonthlyExp(me);
        setLowStockProducts(lsp); setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  const filtered = filter === 'all' ? pending : pending.filter(i => i.status === filter);
  const maxMonthly = Math.max(...monthly.map(m => m.collected), 1);
  const thisMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpTotal = monthlyExp.find(m => m.month === thisMonth)?.amount ?? 0;
  const netThisMonth = stats.monthlyCollected - monthlyExpTotal;

  const FILTERS: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: colors.primary },
    { key: 'overdue', label: 'Vencidas', color: colors.danger },
    { key: 'partial', label: 'Parcial', color: colors.warning },
    { key: 'pending', label: 'Pendiente', color: colors.textDim },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >

      {/* Row 1: Clients · Por cobrar · Vencidas */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCardBtn} onPress={() => router.push('/clients')} activeOpacity={0.7}>
          <StatCard icon="people" label="Clientes" value={stats.totalClients.toString()} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCardBtn} onPress={() => router.push('/cobros')} activeOpacity={0.7}>
          <StatCard icon="today" label="Por cobrar" value={stats.todayCount.toString()} color={colors.warning} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCardBtn} onPress={() => router.push('/cobros')} activeOpacity={0.7}>
          <StatCard icon="alert-circle" label="Vencidas" value={stats.overdueCount.toString()} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Row 2: Ventas del mes · Gastos del mes */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCardBtn} onPress={() => router.push('/reportes')} activeOpacity={0.7}>
          <StatCard icon="cart" label="Ventas del mes" value={formatCurrency(stats.monthlySales)} color={colors.primary} small />
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCardBtn} onPress={() => router.push('/gastos')} activeOpacity={0.7}>
          <StatCard icon="receipt" label="Gastos del mes" value={formatCurrency(monthlyExpTotal)} color={colors.danger} small />
        </TouchableOpacity>
      </View>

      {/* P&L */}
      <View style={styles.plRow}>
        <TouchableOpacity style={[styles.plCard, { borderLeftColor: colors.success }]} onPress={() => setShowMonthly(v => !v)} activeOpacity={0.8}>
          <Text style={styles.plLabel}>Cobrado este mes</Text>
          <Text style={[styles.plValue, { color: colors.success }]}>{formatCurrency(stats.monthlyCollected)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.plCard, { borderLeftColor: netThisMonth >= 0 ? colors.success : colors.danger }]} onPress={() => router.push('/reportes')} activeOpacity={0.8}>
          <Text style={styles.plLabel}>Resultado neto</Text>
          <Text style={[styles.plValue, { color: netThisMonth >= 0 ? colors.success : colors.danger }]}>
            {netThisMonth >= 0 ? '+' : ''}{formatCurrency(netThisMonth)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Monthly chart */}
      {showMonthly && (
        <View style={styles.chartCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.chartTitle}>Cobrado por mes (últimos 12 meses)</Text>
            <TouchableOpacity onPress={() => setShowMonthly(false)}>
              <Ionicons name="chevron-up" size={16} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <View style={styles.chartBars}>
            {monthly.map((m) => {
              const ratio = m.collected / maxMonthly;
              const monthLabel = m.month.substring(5);
              const isCurrentMonth = m.month === new Date().toISOString().substring(0, 7);
              return (
                <View key={m.month} style={styles.barCol}>
                  <Text style={styles.barAmount} numberOfLines={1}>
                    {m.collected > 0 ? `${Math.round(m.collected / 1000)}k` : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { flex: ratio || 0.02 }, isCurrentMonth && { backgroundColor: colors.success }]} />
                    <View style={{ flex: 1 - (ratio || 0.02) }} />
                  </View>
                  <Text style={[styles.barLabel, isCurrentMonth && { color: colors.success, fontWeight: '700' }]}>
                    {monthLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Low stock products */}
      {lowStockProducts.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="warning" size={15} color={colors.warning} />
              <Text style={styles.sectionTitle}>Stock bajo</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/stock')} style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lowStockRow}>
            {lowStockProducts.map(p => {
              const isEmpty = p.stock === 0;
              const color = isEmpty ? colors.danger : colors.warning;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.lowStockCard, { borderTopColor: color }]}
                  onPress={() => router.push(`/product/${p.id}`)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.lowStockBadge, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.lowStockNum, { color }]}>{p.stock}</Text>
                    <Text style={[styles.lowStockUnit, { color }]}>{isEmpty ? 'sin stock' : 'uds'}</Text>
                  </View>
                  <Text style={styles.lowStockName} numberOfLines={2}>{p.name}</Text>
                  {p.category_name && <Text style={styles.lowStockCat}>{p.category_name}</Text>}
                  <Text style={styles.lowStockMin}>Mín: {p.min_stock}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Pending installments */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pendiente de cobro</Text>
        {pending.length > 0 && (
          <Text style={styles.sectionCount}>{filtered.length}{filter !== 'all' ? `/${pending.length}` : ''}</Text>
        )}
      </View>

      {pending.length > 0 && (
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && { backgroundColor: f.color + '22', borderColor: f.color }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && { color: f.color, fontWeight: '700' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={40} color={colors.success} />
          <Text style={styles.emptyText}>{pending.length === 0 ? 'Todo al día' : 'Sin resultados para este filtro'}</Text>
        </View>
      ) : (
        filtered.map((inst) => (
          <TouchableOpacity
            key={inst.id}
            style={styles.installmentCard}
            onPress={() => router.push(`/sale/${inst.sale_id}`)}
            activeOpacity={0.7}
          >
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(inst.status) + '33' }]}>
              <View style={[styles.dot, { backgroundColor: getStatusColor(inst.status) }]} />
            </View>
            <View style={styles.instInfo}>
              <Text style={styles.instClient} numberOfLines={1}>{inst.client_name}</Text>
              <Text style={styles.instProduct} numberOfLines={1}>{inst.product_name}</Text>
              <Text style={styles.instDate}>Vence: {formatDate(inst.due_date)}</Text>
            </View>
            <View style={styles.instRight}>
              <Text style={styles.instAmount}>{formatCurrency(inst.expected_amount)}</Text>
              <Text style={[styles.instStatus, { color: getStatusColor(inst.status) }]}>{getStatusLabel(inst.status)}</Text>
              {inst.paid_amount > 0 && <Text style={styles.instPaid}>Pagado: {formatCurrency(inst.paid_amount)}</Text>}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color, small }: { icon: any; label: string; value: string; color: string; small?: boolean }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, small && { fontSize: 16 }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCardBtn: { flex: 1 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderTopWidth: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  statLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },
  plRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  plCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderLeftWidth: 3 },
  plLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500', marginBottom: 4 },
  plValue: { fontSize: 17, fontWeight: '800' },
  chartCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12 },
  chartTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', height: 90, justifyContent: 'flex-end' },
  barAmount: { fontSize: 8, color: colors.textDim, marginBottom: 2 },
  barTrack: { width: '80%', flex: 1, flexDirection: 'column-reverse' },
  barFill: { backgroundColor: colors.primary + 'bb', borderRadius: 3 },
  barLabel: { fontSize: 9, color: colors.textDim, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionCount: { backgroundColor: colors.primary, color: colors.white, fontSize: 12, fontWeight: '700', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  lowStockRow: { gap: 10, paddingBottom: 12 },
  lowStockCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 12,
    width: 120, borderTopWidth: 3, alignItems: 'center', gap: 4,
  },
  lowStockBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', marginBottom: 2 },
  lowStockNum: { fontSize: 22, fontWeight: '900' },
  lowStockUnit: { fontSize: 9, fontWeight: '600' },
  lowStockName: { fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lowStockCat: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  lowStockMin: { fontSize: 10, color: colors.textDim },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  filterText: { fontSize: 12, color: colors.textDim },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  installmentCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  statusDot: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  instInfo: { flex: 1 },
  instClient: { fontSize: 14, fontWeight: '700', color: colors.text },
  instProduct: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  instDate: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  instRight: { alignItems: 'flex-end' },
  instAmount: { fontSize: 15, fontWeight: '800', color: colors.text },
  instStatus: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  instPaid: { fontSize: 10, color: colors.textDim, marginTop: 2 },
});
