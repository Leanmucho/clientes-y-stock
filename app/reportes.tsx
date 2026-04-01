import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getBusinessAnalytics, getMonthlyStats, getMonthlyExpenseStats,
  getOverallStats, exportAllData, getExpenses,
} from '../lib/database';
import { colors } from '../lib/colors';
import { formatCurrency } from '../lib/utils';
import { Loading } from '../components/Loading';
import { downloadFile, toCSV } from '../lib/download';

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(mo) - 1]} ${y.slice(2)}`;
}

function DeltaBadge({ current, previous, invert }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const positive = invert ? !up : up;
  return (
    <View style={[styles.deltaBadge, { backgroundColor: positive ? colors.success + '22' : colors.danger + '22' }]}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={10} color={positive ? colors.success : colors.danger} />
      <Text style={[styles.deltaText, { color: positive ? colors.success : colors.danger }]}>{Math.abs(pct)}%</Text>
    </View>
  );
}

export default function ReportesScreen() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [monthly, setMonthly] = useState<{ month: string; collected: number }[]>([]);
  const [monthlyExp, setMonthlyExp] = useState<{ month: string; amount: number }[]>([]);
  const [overall, setOverall] = useState({ totalSold: 0, totalCollected: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [a, m, me, o] = await Promise.all([
      getBusinessAnalytics(),
      getMonthlyStats(),
      getMonthlyExpenseStats(),
      getOverallStats(),
    ]);
    setAnalytics(a);
    setMonthly(m);
    setMonthlyExp(me);
    setOverall(o);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    load().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleExportExpenses = async () => {
    setExporting(true);
    try {
      const expenses = await getExpenses();
      const headers = ['Fecha', 'Categoría', 'Descripción', 'Monto', 'Método de pago', 'Proveedor', 'Notas'];
      const rows = expenses.map(e => [
        e.date, e.category, e.description, e.amount, e.payment_method, e.supplier_name ?? '', e.notes ?? '',
      ]);
      const date = new Date().toISOString().split('T')[0];
      await downloadFile(toCSV(headers, rows), `gastos-${date}.csv`, 'text/csv');
      Alert.alert('Listo', 'Reporte de gastos exportado.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportFull = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const date = new Date().toISOString().split('T')[0];
      await downloadFile(JSON.stringify(data, null, 2), `backup-completo-${date}.json`, 'application/json');
      Alert.alert('Listo', 'Backup completo exportado.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Loading />;

  const maxCollected = Math.max(...monthly.map(m => m.collected), 1);
  const maxExpense = Math.max(...monthlyExp.map(m => m.amount), 1);
  const maxBoth = Math.max(maxCollected, maxExpense);

  return (
    <>
      <Stack.Screen options={{ title: 'Reportes y Análisis' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >

        {/* This month vs last month */}
        <Text style={styles.sectionLabel}>ESTE MES VS MES ANTERIOR</Text>
        <View style={styles.compGrid}>
          <CompCard
            label="Cobrado"
            current={analytics.thisMonth.collected}
            previous={analytics.lastMonth.collected}
            color={colors.success}
            icon="cash-outline"
          />
          <CompCard
            label="Gastos"
            current={analytics.thisMonth.expenses}
            previous={analytics.lastMonth.expenses}
            color={colors.danger}
            icon="trending-down-outline"
            invert
          />
        </View>

        {/* Net income */}
        <View style={[styles.netCard, { borderLeftColor: analytics.thisMonth.net >= 0 ? colors.success : colors.danger }]}>
          <View style={styles.netTop}>
            <Ionicons
              name={analytics.thisMonth.net >= 0 ? 'trending-up' : 'trending-down'}
              size={22}
              color={analytics.thisMonth.net >= 0 ? colors.success : colors.danger}
            />
            <Text style={styles.netLabel}>Resultado neto este mes</Text>
            <DeltaBadge current={analytics.thisMonth.net} previous={analytics.lastMonth.net} />
          </View>
          <Text style={[styles.netValue, { color: analytics.thisMonth.net >= 0 ? colors.success : colors.danger }]}>
            {analytics.thisMonth.net >= 0 ? '+' : ''}{formatCurrency(analytics.thisMonth.net)}
          </Text>
          <Text style={styles.netSub}>
            {formatCurrency(analytics.thisMonth.collected)} cobrado — {formatCurrency(analytics.thisMonth.expenses)} gastos
          </Text>
        </View>

        {/* Activity */}
        <View style={styles.activityRow}>
          <View style={styles.actCard}>
            <Text style={styles.actNum}>{analytics.newSalesThisMonth}</Text>
            <Text style={styles.actLabel}>Ventas este mes</Text>
          </View>
          <View style={styles.actCard}>
            <Text style={styles.actNum}>{analytics.newClientsThisMonth}</Text>
            <Text style={styles.actLabel}>Clientes nuevos</Text>
          </View>
        </View>

        {/* Revenue chart */}
        <Text style={styles.sectionLabel}>COBROS VS GASTOS — ÚLTIMOS 12 MESES</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Cobros</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.legendText}>Gastos</Text>
            </View>
          </View>
          <View style={styles.chartBars}>
            {monthly.map((m, i) => {
              const me = monthlyExp[i];
              const colRatio = m.collected / maxBoth;
              const expRatio = (me?.amount ?? 0) / maxBoth;
              const isCurrentMonth = m.month === new Date().toISOString().substring(0, 7);
              return (
                <View key={m.month} style={styles.barGroup}>
                  <View style={styles.barPair}>
                    <View style={styles.barSingle}>
                      <View style={{ flex: 1 - colRatio }} />
                      <View style={[styles.barFill, { flex: colRatio || 0.01, backgroundColor: isCurrentMonth ? colors.success : colors.success + '88' }]} />
                    </View>
                    <View style={styles.barSingle}>
                      <View style={{ flex: 1 - expRatio }} />
                      <View style={[styles.barFill, { flex: expRatio || 0.01, backgroundColor: isCurrentMonth ? colors.danger : colors.danger + '88' }]} />
                    </View>
                  </View>
                  <Text style={[styles.barLabel, isCurrentMonth && { color: colors.primary, fontWeight: '700' }]}>
                    {monthLabel(m.month)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Expenses by category */}
        {analytics.expensesByCategory.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>GASTOS POR CATEGORÍA — ESTE MES</Text>
            <View style={styles.catCard}>
              {analytics.expensesByCategory.map(({ category, amount }: { category: string; amount: number }) => {
                const pct = analytics.thisMonth.expenses > 0 ? amount / analytics.thisMonth.expenses : 0;
                return (
                  <View key={category} style={styles.catRow}>
                    <Text style={styles.catLabel}>{category}</Text>
                    <View style={styles.catBarTrack}>
                      <View style={[styles.catBarFill, { flex: pct }]} />
                      <View style={{ flex: 1 - pct }} />
                    </View>
                    <Text style={styles.catAmount}>{formatCurrency(amount)}</Text>
                    <Text style={styles.catPct}>{Math.round(pct * 100)}%</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Overall totals */}
        <Text style={styles.sectionLabel}>TOTALES HISTÓRICOS</Text>
        <View style={styles.overallCard}>
          <OverallRow label="Total vendido" value={formatCurrency(overall.totalSold)} color={colors.primary} />
          <View style={styles.divider} />
          <OverallRow label="Total cobrado" value={formatCurrency(overall.totalCollected)} color={colors.success} />
          <View style={styles.divider} />
          <OverallRow label="Deuda pendiente" value={formatCurrency(overall.totalPending)} color={colors.warning} />
          <View style={styles.divider} />
          <OverallRow
            label="Efectividad de cobro"
            value={overall.totalSold > 0 ? `${Math.round((overall.totalCollected / overall.totalSold) * 100)}%` : '-'}
            color={colors.primary}
          />
        </View>

        {/* Export */}
        <Text style={styles.sectionLabel}>EXPORTAR</Text>
        <View style={styles.exportCard}>
          {exporting && (
            <View style={styles.exportingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.exportingText}>Exportando...</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.5 }]} onPress={handleExportExpenses} disabled={exporting} activeOpacity={0.7}>
            <View style={styles.exportIcon}>
              <Ionicons name="receipt-outline" size={20} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportTitle}>Reporte de gastos</Text>
              <Text style={styles.exportSubtitle}>Todos los gastos en CSV (Excel)</Text>
            </View>
            <Ionicons name="download-outline" size={16} color={colors.textDim} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={[styles.exportBtn, exporting && { opacity: 0.5 }]} onPress={handleExportFull} disabled={exporting} activeOpacity={0.7}>
            <View style={[styles.exportIcon, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportTitle}>Backup completo</Text>
              <Text style={styles.exportSubtitle}>Todos los datos en JSON</Text>
            </View>
            <Ionicons name="download-outline" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </>
  );
}

function CompCard({ label, current, previous, color, icon, invert }: any) {
  return (
    <View style={[styles.compCard, { borderTopColor: color }]}>
      <View style={styles.compHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[styles.compLabel, { color }]}>{label}</Text>
        <DeltaBadge current={current} previous={previous} invert={invert} />
      </View>
      <Text style={[styles.compValue, { color }]}>{formatCurrency(current)}</Text>
      <Text style={styles.compPrev}>vs {formatCurrency(previous)} mes ant.</Text>
    </View>
  );
}

function OverallRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.overallRow}>
      <Text style={styles.overallLabel}>{label}</Text>
      <Text style={[styles.overallValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 10, marginTop: 20, marginLeft: 2 },
  deltaBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 2 },
  deltaText: { fontSize: 10, fontWeight: '700' },
  compGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  compCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderTopWidth: 3 },
  compHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  compLabel: { flex: 1, fontSize: 12, fontWeight: '700' },
  compValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  compPrev: { fontSize: 11, color: colors.textDim },
  netCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginBottom: 12, borderLeftWidth: 4 },
  netTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  netLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textMuted },
  netValue: { fontSize: 30, fontWeight: '800', marginBottom: 4 },
  netSub: { fontSize: 12, color: colors.textDim },
  activityRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  actCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center' },
  actNum: { fontSize: 28, fontWeight: '800', color: colors.text },
  actLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  chartCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12 },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.textMuted },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 },
  barGroup: { flex: 1, alignItems: 'center' },
  barPair: { flex: 1, flexDirection: 'row', gap: 1, width: '100%' },
  barSingle: { flex: 1, flexDirection: 'column-reverse' },
  barFill: { borderRadius: 2 },
  barLabel: { fontSize: 8, color: colors.textDim, marginTop: 3, textAlign: 'center' },
  catCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 12, gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catLabel: { fontSize: 12, color: colors.textMuted, width: 90 },
  catBarTrack: { flex: 1, height: 6, flexDirection: 'row', borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' },
  catBarFill: { backgroundColor: colors.danger + '88', borderRadius: 3 },
  catAmount: { fontSize: 12, fontWeight: '700', color: colors.text, width: 70, textAlign: 'right' },
  catPct: { fontSize: 10, color: colors.textDim, width: 30, textAlign: 'right' },
  overallCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  overallRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  overallLabel: { fontSize: 14, color: colors.textMuted },
  overallValue: { fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  exportCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  exportingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.primary + '11' },
  exportingText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  exportIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.danger + '22', justifyContent: 'center', alignItems: 'center' },
  exportTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  exportSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
