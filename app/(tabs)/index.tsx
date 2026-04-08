import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Dimensions, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import { DashboardSkeleton } from '../../components/SkeletonLoader';
import { useDashboard } from '../../hooks/useDashboard';
import type { TodayInstallment, LowStockProduct, WeeklySaleStat } from '../../types';

type FilterStatus = 'all' | 'overdue' | 'pending' | 'partial';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - 32, 600);

const FILTERS: { key: FilterStatus; label: string; color: string }[] = [
  { key: 'all', label: 'Todos', color: colors.primary },
  { key: 'overdue', label: 'Vencidas', color: colors.danger },
  { key: 'partial', label: 'Parcial', color: colors.warning },
  { key: 'pending', label: 'Pendiente', color: colors.textDim },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { stats, pending, monthly, monthlyExp, lowStock, weekly, loading, refreshing, error, refresh } = useDashboard();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [showChart, setShowChart] = useState(false);

  if (loading) return <DashboardSkeleton />;

  const filtered: TodayInstallment[] =
    filter === 'all' ? pending : pending.filter((i) => i.status === filter);

  const thisMonth = new Date().toISOString().substring(0, 7);
  const monthlyExpTotal = monthlyExp.find((m) => m.month === thisMonth)?.amount ?? 0;
  const netThisMonth = stats.monthlyCollected - monthlyExpTotal;

  const chartLabels = weekly.map((w) => w.label);
  const chartData = weekly.map((w) => w.total);
  const hasChartData = chartData.some((v) => v > 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Stat widgets */}
      <View style={styles.statsRow}>
        <StatCard icon="people" label="Clientes" value={stats.totalClients} color={colors.primary} onPress={() => router.push('/clients')} />
        <StatCard icon="today" label="Cobros hoy" value={stats.todayCount} color={colors.warning} />
        <StatCard icon="alert-circle" label="Vencidas" value={stats.overdueCount} color={colors.danger} />
      </View>

      {/* P&L row */}
      <View style={styles.plRow}>
        <TouchableOpacity
          style={[styles.plCard, { borderLeftColor: colors.success }]}
          onPress={() => setShowChart((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={styles.plLabel}>Cobrado este mes</Text>
          <Text style={[styles.plValue, { color: colors.success }]}>
            {formatCurrency(stats.monthlyCollected)}
          </Text>
          <Text style={styles.plHint}>
            <Ionicons name={showChart ? 'chevron-up' : 'bar-chart-outline'} size={11} /> ver semanal
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.plCard, { borderLeftColor: colors.danger }]}
          onPress={() => router.push('/gastos')}
          activeOpacity={0.8}
        >
          <Text style={styles.plLabel}>Gastos este mes</Text>
          <Text style={[styles.plValue, { color: colors.danger }]}>
            {formatCurrency(monthlyExpTotal)}
          </Text>
          <Text style={styles.plHint}>
            <Ionicons name="chevron-forward" size={11} /> ver detalle
          </Text>
        </TouchableOpacity>
      </View>

      {/* Net result */}
      <TouchableOpacity
        style={[styles.netCard, { borderLeftColor: netThisMonth >= 0 ? colors.success : colors.danger }]}
        onPress={() => router.push('/reportes')}
        activeOpacity={0.8}
      >
        <Ionicons
          name={netThisMonth >= 0 ? 'trending-up' : 'trending-down'}
          size={18}
          color={netThisMonth >= 0 ? colors.success : colors.danger}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.netLabel}>Resultado neto — este mes</Text>
          <Text style={[styles.netValue, { color: netThisMonth >= 0 ? colors.success : colors.danger }]}>
            {netThisMonth >= 0 ? '+' : ''}{formatCurrency(netThisMonth)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
      </TouchableOpacity>

      {/* Weekly chart */}
      {showChart && hasChartData && Platform.OS !== 'web' && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Cobros — últimos 7 días</Text>
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: chartData, strokeWidth: 2 }] }}
            width={CHART_WIDTH - 28}
            height={160}
            yAxisLabel="$"
            yAxisSuffix=""
            formatYLabel={(v) => {
              const n = parseFloat(v);
              return n >= 1000 ? `${Math.round(n / 1000)}k` : v;
            }}
            chartConfig={{
              backgroundColor: colors.surface,
              backgroundGradientFrom: colors.surface,
              backgroundGradientTo: colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
              labelColor: () => colors.textDim,
              propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
            }}
            bezier
            style={{ marginVertical: 4, borderRadius: 10 }}
          />
        </View>
      )}

      {/* Low stock widget */}
      {lowStock.length > 0 && (
        <View style={styles.lowStockCard}>
          <TouchableOpacity
            style={styles.lowStockHeader}
            onPress={() => router.push('/stock')}
            activeOpacity={0.8}
          >
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={styles.lowStockTitle}>
              {lowStock.length} producto{lowStock.length > 1 ? 's' : ''} con stock bajo
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.warning} />
          </TouchableOpacity>
          {lowStock.slice(0, 3).map((p) => (
            <LowStockRow key={p.id} product={p} onPress={() => router.push(`/product/${p.id}`)} />
          ))}
          {lowStock.length > 3 && (
            <TouchableOpacity onPress={() => router.push('/stock')} style={styles.viewMoreBtn}>
              <Text style={styles.viewMoreText}>Ver los {lowStock.length - 3} restantes</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Pending collections */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pendiente de cobro</Text>
        {pending.length > 0 && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{filtered.length}{filter !== 'all' ? `/${pending.length}` : ''}</Text>
          </View>
        )}
      </View>

      {pending.length > 0 && (
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
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
          <Text style={styles.emptyText}>
            {pending.length === 0 ? 'Todo al día' : 'Sin resultados para este filtro'}
          </Text>
        </View>
      ) : (
        filtered.map((inst) => (
          <InstallmentRow
            key={inst.id}
            inst={inst}
            onPress={() => router.push(`/sale/${inst.sale_id}`)}
          />
        ))
      )}
    </ScrollView>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  color: string;
  onPress?: () => void;
}

function StatCard({ icon, label, value, color, onPress }: StatCardProps) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderTopColor: color }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Ionicons name={icon as Parameters<typeof Ionicons>[0]['name']} size={22} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LowStockRow({ product, onPress }: { product: LowStockProduct; onPress: () => void }) {
  const isEmpty = product.stock === 0;
  return (
    <TouchableOpacity style={styles.lowStockRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.stockDot, { backgroundColor: isEmpty ? colors.danger + '22' : colors.warning + '22' }]}>
        <Text style={[styles.stockDotNum, { color: isEmpty ? colors.danger : colors.warning }]}>
          {product.stock}
        </Text>
      </View>
      <Text style={styles.lowStockName} numberOfLines={1}>{product.name}</Text>
      <Text style={styles.lowStockMin}>mín. {product.min_stock}</Text>
    </TouchableOpacity>
  );
}

function InstallmentRow({ inst, onPress }: { inst: TodayInstallment; onPress: () => void }) {
  const statusColor = getStatusColor(inst.status);
  return (
    <TouchableOpacity style={styles.installmentCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.statusDot, { backgroundColor: statusColor + '33' }]}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
      </View>
      <View style={styles.instInfo}>
        <Text style={styles.instClient} numberOfLines={1}>{inst.client_name}</Text>
        <Text style={styles.instProduct} numberOfLines={1}>{inst.product_name}</Text>
        <Text style={styles.instDate}>Vence: {formatDate(inst.due_date)}</Text>
      </View>
      <View style={styles.instRight}>
        <Text style={styles.instAmount}>{formatCurrency(inst.expected_amount)}</Text>
        <Text style={[styles.instStatus, { color: statusColor }]}>{getStatusLabel(inst.status)}</Text>
        {inst.paid_amount > 0 && (
          <Text style={styles.instPaid}>Pagado: {formatCurrency(inst.paid_amount)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '18', borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: colors.danger + '40',
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 4, borderTopWidth: 3,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  plRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  plCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderLeftWidth: 3, gap: 2 },
  plLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  plValue: { fontSize: 18, fontWeight: '800' },
  plHint: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  netCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderLeftWidth: 3,
  },
  netLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  netValue: { fontSize: 20, fontWeight: '800' },
  chartCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12,
  },
  chartTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  lowStockCard: {
    backgroundColor: colors.warning + '12', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.warning + '30', marginBottom: 16, gap: 8,
  },
  lowStockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lowStockTitle: { flex: 1, fontWeight: '700', fontSize: 13, color: colors.warning },
  lowStockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  stockDot: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  stockDotNum: { fontSize: 14, fontWeight: '800' },
  lowStockName: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  lowStockMin: { fontSize: 11, color: colors.textDim },
  viewMoreBtn: { paddingTop: 4, alignItems: 'center' },
  viewMoreText: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionBadge: {
    backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  sectionBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  filterBtn: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  filterText: { fontSize: 12, color: colors.textDim },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  installmentCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10,
  },
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
