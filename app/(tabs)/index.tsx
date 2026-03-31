import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getTodayInstallments, getMonthlyStats } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import { Loading } from '../../components/Loading';

type FilterStatus = 'all' | 'overdue' | 'pending' | 'partial';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({ totalClients: 0, overdueCount: 0, todayCount: 0, monthlyCollected: 0, lowStockCount: 0 });
  const [pending, setPending] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<{ month: string; collected: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showMonthly, setShowMonthly] = useState(false);

  const load = useCallback(async () => {
    const [s, p, m] = await Promise.all([getDashboardStats(), getTodayInstallments(), getMonthlyStats()]);
    setStats(s); setPending(p); setMonthly(m); setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    // Show stale data instantly, then refresh in background
    Promise.all([getDashboardStats(), getTodayInstallments(), getMonthlyStats()]).then(([s, p, m]) => {
      if (!active) return;
      setStats(s); setPending(p); setMonthly(m); setLoading(false);
    });
    setLoading(false); // don't block render on refocus
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  const filtered = filter === 'all' ? pending : pending.filter(i => i.status === filter);

  const maxMonthly = Math.max(...monthly.map(m => m.collected), 1);

  const FILTERS: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: colors.primary },
    { key: 'overdue', label: 'Vencidas', color: colors.danger },
    { key: 'partial', label: 'Parcial', color: colors.warning },
    { key: 'pending', label: 'Pendiente', color: colors.textDim },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="people" label="Clientes" value={stats.totalClients.toString()} color={colors.primary} />
        <StatCard icon="today" label="Cobros hoy" value={stats.todayCount.toString()} color={colors.warning} />
        <StatCard icon="alert-circle" label="Vencidas" value={stats.overdueCount.toString()} color={colors.danger} />
      </View>

      {/* Monthly collected */}
      <View style={styles.monthCard}>
        <Ionicons name="trending-up" size={20} color={colors.success} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.monthLabel}>Cobrado este mes</Text>
          <Text style={styles.monthValue}>{formatCurrency(stats.monthlyCollected)}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowMonthly(v => !v)} style={styles.monthToggle}>
          <Ionicons name={showMonthly ? 'chevron-up' : 'bar-chart-outline'} size={18} color={colors.success} />
        </TouchableOpacity>
      </View>

      {/* Monthly chart */}
      {showMonthly && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Cobrado por mes (últimos 12 meses)</Text>
          <View style={styles.chartBars}>
            {monthly.map((m) => {
              const ratio = m.collected / maxMonthly;
              const monthLabel = m.month.substring(5); // MM
              const isCurrentMonth = m.month === new Date().toISOString().substring(0, 7);
              return (
                <View key={m.month} style={styles.barCol}>
                  <Text style={styles.barAmount} numberOfLines={1}>
                    {m.collected > 0 ? `${Math.round(m.collected / 1000)}k` : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[
                      styles.barFill,
                      { flex: ratio || 0.02 },
                      isCurrentMonth && { backgroundColor: colors.success },
                    ]} />
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

      {stats.lowStockCount > 0 && (
        <TouchableOpacity style={styles.lowStockAlert} onPress={() => router.push('/stock')} activeOpacity={0.8}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={styles.lowStockText}>{stats.lowStockCount} producto{stats.lowStockCount > 1 ? 's' : ''} con stock bajo</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* Filter + pending */}
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
          <TouchableOpacity key={inst.id} style={styles.installmentCard}
            onPress={() => router.push(`/sale/${inst.sale_id}`)} activeOpacity={0.7}>
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

function StatCard({ icon, label, value, color }: any) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4, borderTopWidth: 3 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  monthCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.success },
  monthLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  monthValue: { fontSize: 22, fontWeight: '800', color: colors.success },
  monthToggle: { padding: 4 },
  chartCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12 },
  chartTitle: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 12 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', height: 90, justifyContent: 'flex-end' },
  barAmount: { fontSize: 8, color: colors.textDim, marginBottom: 2 },
  barTrack: { width: '80%', flex: 1, flexDirection: 'column-reverse' },
  barFill: { backgroundColor: colors.primary + 'bb', borderRadius: 3 },
  barLabel: { fontSize: 9, color: colors.textDim, marginTop: 3 },
  lowStockAlert: { backgroundColor: colors.warning + '22', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.warning + '44' },
  lowStockText: { flex: 1, color: colors.warning, fontWeight: '600', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionCount: { backgroundColor: colors.primary, color: colors.white, fontSize: 12, fontWeight: '700', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
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
