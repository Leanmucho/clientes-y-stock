import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDashboardStats, getTodayInstallments } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import { Loading } from '../../components/Loading';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({ totalClients: 0, overdueCount: 0, todayCount: 0, monthlyCollected: 0, lowStockCount: 0 });
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([getDashboardStats(), getTodayInstallments()]);
    setStats(s);
    setPending(p);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getDashboardStats(), getTodayInstallments()]).then(([s, p]) => {
      if (!active) return;
      setStats(s); setPending(p); setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="people" label="Clientes" value={stats.totalClients.toString()} color={colors.primary} />
        <StatCard icon="today" label="Cobros hoy" value={stats.todayCount.toString()} color={colors.warning} />
        <StatCard icon="alert-circle" label="Vencidas" value={stats.overdueCount.toString()} color={colors.danger} />
      </View>

      {/* Monthly + low stock */}
      <View style={styles.monthCard}>
        <Ionicons name="trending-up" size={20} color={colors.success} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.monthLabel}>Cobrado este mes</Text>
          <Text style={styles.monthValue}>{formatCurrency(stats.monthlyCollected)}</Text>
        </View>
      </View>

      {stats.lowStockCount > 0 && (
        <TouchableOpacity style={styles.lowStockAlert} onPress={() => router.push('/stock')} activeOpacity={0.8}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={styles.lowStockText}>{stats.lowStockCount} producto{stats.lowStockCount > 1 ? 's' : ''} con stock bajo</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* Pending */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pendiente de cobro</Text>
        {pending.length > 0 && <Text style={styles.sectionCount}>{pending.length}</Text>}
      </View>

      {pending.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={40} color={colors.success} />
          <Text style={styles.emptyText}>Todo al día</Text>
        </View>
      ) : (
        pending.map((inst) => (
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
  monthValue: { fontSize: 24, fontWeight: '800', color: colors.success },
  lowStockAlert: { backgroundColor: colors.warning + '22', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.warning + '44' },
  lowStockText: { flex: 1, color: colors.warning, fontWeight: '600', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionCount: { backgroundColor: colors.primary, color: colors.white, fontSize: 12, fontWeight: '700', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
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
