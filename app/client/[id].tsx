import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClient, getSalesByClient } from '../../lib/database';
import { Client, Sale } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Loading } from '../../components/Loading';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([getClient(Number(id)), getSalesByClient(Number(id))]);
    setClient(c); setSales(s); setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getClient(Number(id)), getSalesByClient(Number(id))]).then(([c, s]) => {
      if (!active) return;
      setClient(c); setSales(s); setLoading(false);
    });
    return () => { active = false; };
  }, [id]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <Loading />;
  if (!client) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Cliente no encontrado</Text></View>;

  const totalDebt = sales.reduce((acc, s) => acc + (s.total_amount - s.advance_payment), 0);

  return (
    <>
      <Stack.Screen options={{ title: client.name }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.clientName}>{client.name}</Text>
            {client.dni ? <InfoRow icon="card-outline" text={client.dni} /> : null}
            {client.phone ? <InfoRow icon="call-outline" text={client.phone} /> : null}
            {client.address ? <InfoRow icon="location-outline" text={client.address} /> : null}
            {client.reference ? <InfoRow icon="people-outline" text={client.reference} /> : null}
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{sales.length}</Text>
            <Text style={styles.summaryLabel}>Compras</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: colors.warning }]}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>{formatCurrency(totalDebt)}</Text>
            <Text style={styles.summaryLabel}>Deuda total</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Compras</Text>
          <TouchableOpacity style={styles.addSaleButton}
            onPress={() => router.push({ pathname: '/sale/new', params: { clientId: client.id, clientName: client.name } })}>
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.addSaleText}>Nueva compra</Text>
          </TouchableOpacity>
        </View>

        {sales.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="bag-outline" size={36} color={colors.textDim} />
            <Text style={styles.emptyText}>Sin compras registradas</Text>
          </View>
        ) : (
          sales.map((sale) => (
            <TouchableOpacity key={sale.id} style={styles.saleCard} onPress={() => router.push(`/sale/${sale.id}`)} activeOpacity={0.7}>
              <View style={styles.saleHeader}>
                <Text style={styles.productName} numberOfLines={1}>{sale.product_name}</Text>
                <Text style={styles.saleDate}>{formatDate(sale.start_date)}</Text>
              </View>
              <View style={styles.saleDetails}>
                <DetailChip label="Total" value={formatCurrency(sale.total_amount)} />
                <DetailChip label="Anticipo" value={formatCurrency(sale.advance_payment)} color={colors.success} />
                <DetailChip label="Cuotas" value={`${sale.installments_count}x${formatCurrency(sale.installment_amount)}`} color={colors.primary} />
              </View>
              <View style={styles.saleFooter}>
                <Ionicons name="calendar-outline" size={12} color={colors.textDim} />
                <Text style={styles.paymentDay}>Día {sale.payment_day} de cada mes</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </>
  );
}

function InfoRow({ icon, text }: { icon: any; text: string }) {
  return <View style={styles.infoRow}><Ionicons name={icon} size={13} color={colors.textDim} /><Text style={styles.infoText}>{text}</Text></View>;
}
function DetailChip({ label, value, color }: { label: string; value: string; color?: string }) {
  return <View style={styles.chip}><Text style={styles.chipLabel}>{label}</Text><Text style={[styles.chipValue, color ? { color } : {}]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  headerCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 14, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.primary },
  headerInfo: { flex: 1 },
  clientName: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  infoText: { fontSize: 13, color: colors.textMuted },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderTopWidth: 3, borderTopColor: colors.primary },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  addSaleButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addSaleText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 32, alignItems: 'center', gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  saleCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: colors.primary },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  saleDate: { fontSize: 12, color: colors.textDim },
  saleDetails: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  chipLabel: { fontSize: 10, color: colors.textDim, marginBottom: 1 },
  chipValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  saleFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  paymentDay: { fontSize: 12, color: colors.textDim },
});
