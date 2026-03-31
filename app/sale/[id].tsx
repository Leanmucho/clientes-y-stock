import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSale, getInstallmentsBySale, registerPayment } from '../../lib/database';
import { Sale, Installment } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, getTodayISO } from '../../lib/utils';
import { Loading } from '../../components/Loading';

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentModal, setPaymentModal] = useState<Installment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payNotes, setPayNotes] = useState('');
  const [registering, setRegistering] = useState(false);

  const load = useCallback(async () => {
    const [s, insts] = await Promise.all([getSale(Number(id)), getInstallmentsBySale(Number(id))]);
    setSale(s); setInstallments(insts); setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSale(Number(id)), getInstallmentsBySale(Number(id))]).then(([s, insts]) => {
      if (!active) return;
      setSale(s); setInstallments(insts); setLoading(false);
    });
    return () => { active = false; };
  }, [id]));

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const openPayment = (inst: Installment) => {
    setPaymentModal(inst);
    setPayAmount(inst.paid_amount > 0 ? inst.paid_amount.toString() : inst.expected_amount.toString());
    setPayDate(inst.paid_date ?? getTodayISO());
    setPayNotes(inst.notes ?? '');
  };

  const handleRegisterPayment = async () => {
    if (!paymentModal) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount < 0) return Alert.alert('Inválido', 'Ingresá un monto válido.');
    setRegistering(true);
    await registerPayment(paymentModal.id, amount, payDate, payNotes);
    setPaymentModal(null);
    setRegistering(false);
    load();
  };

  const handleMarkUnpaid = async () => {
    if (!paymentModal) return;
    setRegistering(true);
    await registerPayment(paymentModal.id, 0, '', '');
    setPaymentModal(null);
    setRegistering(false);
    load();
  };

  if (loading) return <Loading />;
  if (!sale) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Venta no encontrada</Text></View>;

  const paidCount = installments.filter((i) => i.status === 'paid').length;
  const totalPaid = installments.reduce((acc, i) => acc + i.paid_amount, 0);
  const totalExpected = installments.reduce((acc, i) => acc + i.expected_amount, 0);
  const progress = totalExpected > 0 ? totalPaid / totalExpected : 0;

  return (
    <>
      <Stack.Screen options={{
        title: sale.product_name,
        headerRight: () => sale.client_name ? (
          <TouchableOpacity onPress={() => router.push(`/client/${sale.client_id}`)} style={{ marginRight: 4 }}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>{sale.client_name}</Text>
          </TouchableOpacity>
        ) : null,
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        <View style={styles.summaryCard}>
          {sale.client_name && <View style={styles.clientRow}><Ionicons name="person-circle" size={16} color={colors.primary} /><Text style={styles.clientName}>{sale.client_name}</Text></View>}
          <View style={styles.amountsGrid}>
            <AmountBox label="Total" value={formatCurrency(sale.total_amount)} />
            <AmountBox label="Anticipo" value={formatCurrency(sale.advance_payment)} color={colors.success} />
            <AmountBox label="Cuota" value={formatCurrency(sale.installment_amount)} color={colors.primary} />
            <AmountBox label="Día de pago" value={`Día ${sale.payment_day}`} />
          </View>
          <View style={styles.dateRow}>
            <View style={styles.dateItem}><Ionicons name="calendar-outline" size={13} color={colors.textDim} /><Text style={styles.dateText}>Inicio: {formatDate(sale.start_date)}</Text></View>
            {sale.delivery_date ? <View style={styles.dateItem}><Ionicons name="cube-outline" size={13} color={colors.textDim} /><Text style={styles.dateText}>Entrega: {formatDate(sale.delivery_date)}</Text></View> : null}
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{paidCount} / {sale.installments_count} cuotas pagadas</Text>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { flex: progress }]} />
              <View style={{ flex: 1 - progress }} />
            </View>
          </View>
          <View style={styles.progressAmounts}>
            <Text style={styles.progressPaid}>Cobrado: {formatCurrency(totalPaid)}</Text>
            <Text style={styles.progressPending}>Pendiente: {formatCurrency(totalExpected - totalPaid)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Cuotas</Text>

        {installments.map((inst) => (
          <TouchableOpacity key={inst.id}
            style={[styles.installmentRow, inst.status === 'paid' && styles.instPaidRow, inst.status === 'overdue' && styles.instOverdueRow]}
            onPress={() => openPayment(inst)} activeOpacity={0.75}>
            <View style={[styles.instNumber, { backgroundColor: getStatusColor(inst.status) + '22' }]}>
              <Text style={[styles.instNumberText, { color: getStatusColor(inst.status) }]}>{inst.installment_number}</Text>
            </View>
            <View style={styles.instInfo}>
              <View style={styles.instRow}>
                <Text style={styles.instDue}>Vence: {formatDate(inst.due_date)}</Text>
                <View style={[styles.statusPill, { backgroundColor: getStatusColor(inst.status) + '22' }]}>
                  <Text style={[styles.statusPillText, { color: getStatusColor(inst.status) }]}>{getStatusLabel(inst.status)}</Text>
                </View>
              </View>
              <View style={styles.instAmounts}>
                <View>
                  <Text style={styles.amountLabel}>Debería pagar</Text>
                  <Text style={styles.expectedAmount}>{formatCurrency(inst.expected_amount)}</Text>
                </View>
                {inst.paid_amount > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.amountLabel}>Pagó</Text>
                    <Text style={[styles.paidAmount, { color: inst.paid_amount >= inst.expected_amount ? colors.success : colors.warning }]}>
                      {formatCurrency(inst.paid_amount)}
                    </Text>
                    {inst.paid_amount < inst.expected_amount && (
                      <Text style={styles.diffAmount}>Faltan {formatCurrency(inst.expected_amount - inst.paid_amount)}</Text>
                    )}
                  </View>
                )}
              </View>
              {inst.paid_date && (
                <View style={styles.paidDateRow}>
                  <Ionicons name="checkmark-circle" size={11} color={colors.success} />
                  <Text style={styles.paidDate}>Pagado el {formatDate(inst.paid_date)}</Text>
                </View>
              )}
              {inst.notes ? <Text style={styles.notes}>{inst.notes}</Text> : null}
            </View>
            <Ionicons name="pencil" size={14} color={colors.textDim} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={paymentModal !== null} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Cuota {paymentModal?.installment_number} — {formatDate(paymentModal?.due_date ?? '')}</Text>
            <View style={styles.expectedBox}>
              <Ionicons name="information-circle-outline" size={15} color={colors.textDim} />
              <Text style={styles.expectedText}>
                Monto esperado: <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCurrency(paymentModal?.expected_amount ?? 0)}</Text>
              </Text>
            </View>
            <Text style={styles.modalLabel}>Monto que pagó</Text>
            <View style={styles.modalInputWrapper}>
              <Text style={styles.modalPrefix}>$</Text>
              <TextInput style={styles.modalInput} value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textDim} autoFocus />
            </View>
            <Text style={styles.modalLabel}>Fecha de pago (AAAA-MM-DD)</Text>
            <View style={styles.modalInputWrapper}>
              <TextInput style={styles.modalInput} value={payDate} onChangeText={setPayDate} keyboardType="numeric" placeholder={getTodayISO()} placeholderTextColor={colors.textDim} />
            </View>
            <Text style={styles.modalLabel}>Notas (opcional)</Text>
            <View style={styles.modalInputWrapper}>
              <TextInput style={styles.modalInput} value={payNotes} onChangeText={setPayNotes} placeholder="Ej: Pagó con transferencia" placeholderTextColor={colors.textDim} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPaymentModal(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              {paymentModal?.status !== 'pending' && (
                <TouchableOpacity style={styles.modalUnpaid} onPress={handleMarkUnpaid} disabled={registering}>
                  <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.modalUnpaidText}>Sin pago</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.modalConfirm, registering && { opacity: 0.6 }]} onPress={handleRegisterPayment} disabled={registering}>
                <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                <Text style={styles.modalConfirmText}>{registering ? 'Guardando...' : 'Registrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function AmountBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.amountBox}>
      <Text style={styles.amountBoxLabel}>{label}</Text>
      <Text style={[styles.amountBoxValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  summaryCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  clientName: { fontSize: 14, fontWeight: '700', color: colors.primary },
  amountsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  amountBox: { flex: 1, minWidth: '45%', backgroundColor: colors.bg, borderRadius: 10, padding: 10, alignItems: 'center' },
  amountBoxLabel: { fontSize: 10, color: colors.textDim, marginBottom: 3 },
  amountBoxValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  dateRow: { flexDirection: 'row', gap: 16 },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: colors.textDim },
  progressCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  progressPercent: { fontSize: 13, fontWeight: '800', color: colors.primary },
  progressBar: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressTrack: { flex: 1, flexDirection: 'row', height: 8 },
  progressFill: { backgroundColor: colors.primary, borderRadius: 4 },
  progressAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPaid: { fontSize: 12, color: colors.success, fontWeight: '600' },
  progressPending: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 },
  installmentRow: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  instPaidRow: { opacity: 0.65 },
  instOverdueRow: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  instNumber: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  instNumberText: { fontWeight: '800', fontSize: 14 },
  instInfo: { flex: 1 },
  instRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  instDue: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  instAmounts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  amountLabel: { fontSize: 10, color: colors.textDim, marginBottom: 1 },
  expectedAmount: { fontSize: 16, fontWeight: '700', color: colors.text },
  paidAmount: { fontSize: 16, fontWeight: '800' },
  diffAmount: { fontSize: 11, color: colors.warning, marginTop: 1 },
  paidDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  paidDate: { fontSize: 11, color: colors.success },
  notes: { fontSize: 11, color: colors.textDim, fontStyle: 'italic', marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  expectedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginBottom: 16 },
  expectedText: { fontSize: 13, color: colors.textMuted },
  modalLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginLeft: 2 },
  modalInputWrapper: { backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  modalPrefix: { color: colors.textMuted, fontSize: 16, marginRight: 4 },
  modalInput: { flex: 1, color: colors.text, fontSize: 16 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: colors.textMuted, fontWeight: '700' },
  modalUnpaid: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.danger + '22', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  modalUnpaidText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  modalConfirm: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  modalConfirmText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
