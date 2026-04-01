import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getExpensesByMonth, EXPENSE_CATEGORIES } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getTodayISO } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { Expense } from '../../types';

const CATEGORY_ICONS: Record<string, string> = {
  'Alquiler': 'home-outline',
  'Servicios': 'flash-outline',
  'Stock/Compras': 'cube-outline',
  'Personal': 'people-outline',
  'Transporte': 'car-outline',
  'Marketing': 'megaphone-outline',
  'Impuestos': 'receipt-outline',
  'Otro': 'ellipsis-horizontal-outline',
};

function getMonthOptions() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().substring(0, 7));
  }
  return months;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

export default function GastosScreen() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getTodayISO().substring(0, 7));
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const months = getMonthOptions();

  const load = useCallback(async () => {
    const data = await getExpensesByMonth(selectedMonth);
    setExpenses(data);
    setLoading(false);
  }, [selectedMonth]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    getExpensesByMonth(selectedMonth).then(data => {
      if (!active) return;
      setExpenses(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [selectedMonth]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = filterCategory ? expenses.filter(e => e.category === filterCategory) : expenses;
  const totalMonth = expenses.reduce((acc, e) => acc + e.amount, 0);
  const totalFiltered = filtered.reduce((acc, e) => acc + e.amount, 0);

  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((acc, e) => acc + e.amount, 0),
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Month selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthRow}>
          {months.map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.monthChip, m === selectedMonth && styles.monthChipActive]}
              onPress={() => setSelectedMonth(m)}
            >
              <Text style={[styles.monthChipText, m === selectedMonth && styles.monthChipTextActive]}>
                {monthLabel(m)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Ionicons name="trending-down" size={22} color={colors.danger} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.summaryLabel}>Total gastos — {monthLabel(selectedMonth)}</Text>
              <Text style={styles.summaryTotal}>{formatCurrency(totalMonth)}</Text>
            </View>
            {filterCategory && (
              <View style={styles.filterActive}>
                <Text style={styles.filterActiveText}>{formatCurrency(totalFiltered)}</Text>
                <Text style={styles.filterActiveSub}>filtrado</Text>
              </View>
            )}
          </View>

          {byCategory.length > 0 && (
            <View style={styles.categoryBars}>
              {byCategory.map(({ cat, total }) => {
                const pct = totalMonth > 0 ? total / totalMonth : 0;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={styles.catBarRow}
                    onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[cat] as any || 'ellipsis-horizontal-outline'}
                      size={13}
                      color={filterCategory === cat ? colors.danger : colors.textDim}
                    />
                    <Text style={[styles.catBarLabel, filterCategory === cat && { color: colors.danger, fontWeight: '700' }]}>
                      {cat}
                    </Text>
                    <View style={styles.catBarTrack}>
                      <View style={[styles.catBarFill, { flex: pct, backgroundColor: filterCategory === cat ? colors.danger : colors.danger + '66' }]} />
                      <View style={{ flex: 1 - pct }} />
                    </View>
                    <Text style={styles.catBarAmount}>{formatCurrency(total)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Category filter chips */}
        {expenses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !filterCategory && styles.chipActive]}
              onPress={() => setFilterCategory(null)}
            >
              <Text style={[styles.chipText, !filterCategory && styles.chipTextActive]}>Todos</Text>
            </TouchableOpacity>
            {byCategory.map(({ cat }) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, filterCategory === cat && styles.chipActive]}
                onPress={() => setFilterCategory(filterCategory === cat ? null : cat)}
              >
                <Text style={[styles.chipText, filterCategory === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {filterCategory ? `${filterCategory}` : 'Todos los gastos'}
          </Text>
          <Text style={styles.sectionCount}>{filtered.length}</Text>
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color={colors.textDim} />
            <Text style={styles.emptyTitle}>Sin gastos registrados</Text>
            <Text style={styles.emptySubtitle}>Tocá + para agregar un gasto</Text>
          </View>
        ) : (
          filtered.map(expense => (
            <TouchableOpacity
              key={expense.id}
              style={styles.expenseCard}
              onPress={() => router.push(`/expense/${expense.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={styles.expIcon}>
                <Ionicons
                  name={CATEGORY_ICONS[expense.category] as any || 'receipt-outline'}
                  size={18}
                  color={colors.danger}
                />
              </View>
              <View style={styles.expInfo}>
                <Text style={styles.expDesc} numberOfLines={1}>{expense.description}</Text>
                <View style={styles.expMeta}>
                  <Text style={styles.expCat}>{expense.category}</Text>
                  {expense.supplier_name && (
                    <Text style={styles.expSupplier}> · {expense.supplier_name}</Text>
                  )}
                </View>
                <Text style={styles.expDate}>{formatDate(expense.date)}</Text>
              </View>
              <View style={styles.expRight}>
                <Text style={styles.expAmount}>{formatCurrency(expense.amount)}</Text>
                {expense.payment_method ? (
                  <Text style={styles.expMethod}>{expense.payment_method}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/expense/new' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  monthScroll: { marginBottom: 14, marginHorizontal: -16 },
  monthRow: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  monthChipActive: { backgroundColor: colors.danger + '22', borderColor: colors.danger },
  monthChipText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  monthChipTextActive: { color: colors.danger, fontWeight: '700' },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.danger },
  summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  summaryTotal: { fontSize: 26, fontWeight: '800', color: colors.danger },
  filterActive: { alignItems: 'flex-end' },
  filterActiveText: { fontSize: 15, fontWeight: '800', color: colors.danger },
  filterActiveSub: { fontSize: 10, color: colors.textDim },
  categoryBars: { gap: 6 },
  catBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catBarLabel: { fontSize: 11, color: colors.textMuted, width: 90 },
  catBarTrack: { flex: 1, height: 6, flexDirection: 'row', borderRadius: 3, backgroundColor: colors.bg, overflow: 'hidden' },
  catBarFill: { borderRadius: 3 },
  catBarAmount: { fontSize: 11, fontWeight: '700', color: colors.text, width: 68, textAlign: 'right' },
  chipScroll: { marginBottom: 12, marginHorizontal: -16 },
  chipRow: { paddingHorizontal: 16, gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.danger + '22', borderColor: colors.danger },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textDim },
  chipTextActive: { color: colors.danger, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  sectionCount: { backgroundColor: colors.danger, color: colors.white, fontSize: 12, fontWeight: '700', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  emptySubtitle: { color: colors.textDim, fontSize: 13 },
  expenseCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  expIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.danger + '22', justifyContent: 'center', alignItems: 'center' },
  expInfo: { flex: 1 },
  expDesc: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  expMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  expCat: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  expSupplier: { fontSize: 11, color: colors.textDim },
  expDate: { fontSize: 11, color: colors.textDim },
  expRight: { alignItems: 'flex-end' },
  expAmount: { fontSize: 16, fontWeight: '800', color: colors.danger },
  expMethod: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.danger,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});
