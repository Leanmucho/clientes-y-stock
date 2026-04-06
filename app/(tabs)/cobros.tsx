import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  RefreshControl, TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { markOverdueInstallments } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '../../lib/utils';
import { Loading } from '../../components/Loading';

type PendingItem = {
  id: number;
  sale_id: number;
  installment_number: number;
  due_date: string;
  expected_amount: number;
  paid_amount: number;
  status: string;
  client_name: string;
  client_id: number;
  product_name: string;
};

type TabKey = 'hoy' | 'todos' | 'fecha';

async function fetchPending(): Promise<PendingItem[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('installments')
    .select('id, sale_id, installment_number, due_date, expected_amount, paid_amount, status, sales(product_name, client_id, clients(name))')
    .in('status', ['pending', 'partial', 'overdue'])
    .order('due_date', { ascending: true });

  return ((data ?? []) as any[]).map((i) => {
    // Corrección cliente-side: si el vencimiento ya pasó y el DB todavía dice 'pending', mostrar como overdue
    const effectiveStatus =
      i.status === 'pending' && i.due_date < today ? 'overdue' : i.status;
    return {
      id: i.id,
      sale_id: i.sale_id,
      installment_number: i.installment_number,
      due_date: i.due_date,
      expected_amount: i.expected_amount,
      paid_amount: i.paid_amount,
      status: effectiveStatus,
      client_name: i.sales?.clients?.name ?? '',
      client_id: i.sales?.client_id ?? 0,
      product_name: i.sales?.product_name ?? '',
    };
  });
}

export default function CobrosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('hoy');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const load = useCallback(async () => {
    await markOverdueInstallments();
    const data = await fetchPending();
    setItems(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    markOverdueInstallments()
      .then(() => fetchPending())
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  const today = new Date().toISOString().split('T')[0];

  const isValidDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d).getTime());

  // Auto-format date input as YYYY-MM-DD
  const formatDateInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  };

  const filtered = items.filter((i) => {
    const matchesTab = tab === 'hoy' ? i.due_date <= today : true;
    const matchesDate = tab === 'fecha' && isValidDate(dateFilter) ? i.due_date === dateFilter : true;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      i.client_name.toLowerCase().includes(q) ||
      i.product_name.toLowerCase().includes(q);
    return matchesTab && matchesDate && matchesSearch;
  });

  // Group by due_date for "todos" tab, flat for "hoy"
  type Section = { title: string; data: PendingItem[] };
  let sections: Section[] = [];

  if (tab === 'hoy') {
    const todayItems = filtered.filter(i => i.due_date === today);
    const overdueItems = filtered.filter(i => i.due_date < today);
    if (overdueItems.length > 0) sections.push({ title: `Vencidas anteriores (${overdueItems.length})`, data: overdueItems });
    if (todayItems.length > 0) sections.push({ title: `Hoy — ${formatDate(today)} (${todayItems.length})`, data: todayItems });
  } else if (tab === 'fecha') {
    if (isValidDate(dateFilter)) {
      if (filtered.length > 0) {
        const total = filtered.reduce((acc, i) => acc + (i.expected_amount - i.paid_amount), 0);
        sections.push({ title: `${formatDate(dateFilter)} — ${formatCurrency(total)} pendiente`, data: filtered });
      }
    }
  } else {
    // Group by month
    const byMonth: Record<string, PendingItem[]> = {};
    for (const i of filtered) {
      const month = i.due_date.substring(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(i);
    }
    for (const [month, data] of Object.entries(byMonth)) {
      const [y, m] = month.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      const total = data.reduce((acc, i) => acc + (i.expected_amount - i.paid_amount), 0);
      sections.push({ title: `${label.charAt(0).toUpperCase() + label.slice(1)} — ${formatCurrency(total)} pendiente`, data });
    }
  }

  const totalPending = filtered.reduce((acc, i) => acc + (i.expected_amount - i.paid_amount), 0);
  const countToday = items.filter(i => i.due_date <= today).length;
  const countAll = items.length;

  return (
    <View style={styles.container}>
      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'hoy' && styles.tabBtnActive]}
          onPress={() => setTab('hoy')}
        >
          <Ionicons name="today" size={15} color={tab === 'hoy' ? colors.white : colors.textDim} />
          <Text style={[styles.tabBtnText, tab === 'hoy' && styles.tabBtnTextActive]}>
            Hoy {countToday > 0 ? `(${countToday})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'todos' && styles.tabBtnActive]}
          onPress={() => setTab('todos')}
        >
          <Ionicons name="list" size={15} color={tab === 'todos' ? colors.white : colors.textDim} />
          <Text style={[styles.tabBtnText, tab === 'todos' && styles.tabBtnTextActive]}>
            Todos ({countAll})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'fecha' && styles.tabBtnActive]}
          onPress={() => setTab('fecha')}
        >
          <Ionicons name="calendar" size={15} color={tab === 'fecha' ? colors.white : colors.textDim} />
          <Text style={[styles.tabBtnText, tab === 'fecha' && styles.tabBtnTextActive]}>
            Por fecha
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date filter input */}
      {tab === 'fecha' && (
        <View style={styles.dateFilterRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
          <TextInput
            style={styles.dateFilterInput}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.textDim}
            value={dateFilter}
            onChangeText={(raw) => setDateFilter(formatDateInput(raw))}
            keyboardType="numeric"
            maxLength={10}
          />
          {isValidDate(dateFilter) && (
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          )}
          {dateFilter.length > 0 && (
            <TouchableOpacity onPress={() => setDateFilter('')}>
              <Ionicons name="close-circle" size={16} color={colors.textDim} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cliente o producto..."
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {filtered.length} cuota{filtered.length !== 1 ? 's' : ''} —{' '}
            <Text style={{ color: colors.warning, fontWeight: '800' }}>{formatCurrency(totalPending)}</Text>
            {' '}por cobrar
          </Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        stickySectionHeadersEnabled={true}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons
              name={tab === 'fecha' && !isValidDate(dateFilter) ? 'calendar-outline' : 'checkmark-circle'}
              size={52}
              color={tab === 'fecha' && !isValidDate(dateFilter) ? colors.textDim : colors.success}
            />
            <Text style={styles.emptyTitle}>
              {tab === 'hoy' ? '¡Sin cobros para hoy!' :
               tab === 'fecha' && !isValidDate(dateFilter) ? 'Ingresá una fecha' :
               tab === 'fecha' ? 'Sin cobros ese día' :
               'Sin cuotas pendientes'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'hoy' ? 'No hay cuotas para hoy ni vencidas' :
               tab === 'fecha' && !isValidDate(dateFilter) ? 'Escribí la fecha en formato AAAA-MM-DD para filtrar' :
               tab === 'fecha' ? 'No hay cuotas pendientes para esa fecha' :
               'Todos los clientes están al día'}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const owed = item.expected_amount - item.paid_amount;
          const isOverdue = item.status === 'overdue';
          const isToday = item.due_date === today;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                isOverdue && styles.cardOverdue,
                isToday && styles.cardToday,
              ]}
              onPress={() => router.push(`/sale/${item.sale_id}`)}
              activeOpacity={0.7}
            >
              <View style={[styles.statusBar, { backgroundColor: getStatusColor(item.status) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <TouchableOpacity onPress={() => router.push(`/client/${item.client_id}`)}>
                    <Text style={styles.clientName}>{item.client_name}</Text>
                  </TouchableOpacity>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(item.status) + '22' }]}>
                    <Text style={[styles.statusPillText, { color: getStatusColor(item.status) }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.productName} numberOfLines={1}>{item.product_name}</Text>
                <View style={styles.cardBottom}>
                  <View style={styles.cardBottomLeft}>
                    <Text style={styles.dueDate}>
                      {isToday ? '📅 Hoy' : isOverdue ? `⚠️ ${formatDate(item.due_date)}` : formatDate(item.due_date)}
                    </Text>
                    <Text style={styles.installmentNum}>Cuota {item.installment_number}</Text>
                  </View>
                  <View style={styles.cardBottomRight}>
                    {item.paid_amount > 0 && (
                      <Text style={styles.paidAmount}>Pagó: {formatCurrency(item.paid_amount)}</Text>
                    )}
                    <Text style={styles.owedAmount}>{formatCurrency(owed)}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 8 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 10,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  tabBtnTextActive: { color: colors.white },
  dateFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 6,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.primary + '44',
  },
  dateFilterInput: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 6,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  summaryBar: {
    backgroundColor: colors.warning + '15', marginHorizontal: 12, marginBottom: 6,
    borderRadius: 10, padding: 10, borderWidth: 1, borderColor: colors.warning + '33',
  },
  summaryText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  list: { paddingHorizontal: 12, paddingBottom: 90 },
  sectionHeader: {
    backgroundColor: colors.bg, paddingVertical: 8, paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  emptyCard: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, marginBottom: 8,
    flexDirection: 'row', overflow: 'hidden',
  },
  cardOverdue: { borderWidth: 1, borderColor: colors.danger + '55' },
  cardToday: { borderWidth: 1, borderColor: colors.warning + '77' },
  statusBar: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  clientName: { fontSize: 15, fontWeight: '800', color: colors.text },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  productName: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardBottomLeft: { gap: 2 },
  dueDate: { fontSize: 12, color: colors.textDim, fontWeight: '500' },
  installmentNum: { fontSize: 11, color: colors.textDim },
  cardBottomRight: { alignItems: 'flex-end', gap: 1 },
  paidAmount: { fontSize: 11, color: colors.success },
  owedAmount: { fontSize: 17, fontWeight: '800', color: colors.text },
});
