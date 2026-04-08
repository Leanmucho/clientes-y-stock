import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Share, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSale, getSaleItems, getInstallmentsBySale, registerPayment, updateSale, deleteSale, getClient } from '../../lib/database';
import { generateAndShareReceipt } from '../../services/pdfService';
import { supabase } from '../../lib/supabase';
import { Sale, SaleItem, Installment } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, getTodayISO, formatInputNumber } from '../../lib/utils';
import { Loading } from '../../components/Loading';

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<Installment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payNotes, setPayNotes] = useState('');
  const [registering, setRegistering] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editPaymentDay, setEditPaymentDay] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const [s, its, insts] = await Promise.all([
      getSale(Number(id)),
      getSaleItems(Number(id)),
      getInstallmentsBySale(Number(id)),
    ]);
    setSale(s); setSaleItems(its); setInstallments(insts); setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSale(Number(id)), getSaleItems(Number(id)), getInstallmentsBySale(Number(id))]).then(([s, its, insts]) => {
      if (!active) return;
      setSale(s); setSaleItems(its); setInstallments(insts); setLoading(false);
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
    const closedInst = paymentModal;
    setPaymentModal(null);
    setRegistering(false);
    await load();
    if (sale && amount > 0) {
      offerReceipt(sale, closedInst, amount, payDate);
    }
  };

  const offerReceipt = (s: Sale, inst: Installment, amount: number, date: string) => {
    Alert.alert(
      'Pago registrado ✓',
      '¿Qué querés hacer?',
      [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: '📄 Recibo PDF',
          onPress: () => generatePdfReceipt(s, inst, amount, date),
        },
        {
          text: '💬 Compartir texto',
          onPress: () => shareReceipt(s, inst, amount, date),
        },
      ]
    );
  };

  const generatePdfReceipt = async (s: Sale, inst: Installment, amount: number, date: string) => {
    if (!s.client_id) return;
    try {
      const client = await getClient(s.client_id);
      if (!client) throw new Error('Cliente no encontrado');
      await generateAndShareReceipt({ installment: inst, sale: s, client, paidAmount: amount, paidDate: date });
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar el recibo.');
    }
  };

  const handleMarkUnpaid = async () => {
    if (!paymentModal) return;
    setRegistering(true);
    await registerPayment(paymentModal.id, 0, '', '');
    setPaymentModal(null);
    setRegistering(false);
    await load();
  };

  const shareReceipt = async (s: Sale, inst: Installment, amount: number, date: string) => {
    let bizName = 'Mi Negocio';
    try {
      const { data } = await supabase.auth.getUser();
      bizName = data.user?.user_metadata?.business_name ?? 'Mi Negocio';
    } catch {}

    Alert.alert(
      'Pago registrado',
      `¿Compartir comprobante con ${s.client_name}?`,
      [
        { text: 'No' },
        {
          text: 'Compartir', onPress: () => {
            const remaining = s.installments_count - inst.installment_number;
            const lines = [
              `🧾 *COMPROBANTE DE PAGO*`,
              `📌 ${bizName}`,
              `─────────────────────────`,
              `*Cliente:* ${s.client_name}`,
              `*Producto/Servicio:* ${s.product_name}`,
              `─────────────────────────`,
              `*Cuota:* ${inst.installment_number} de ${s.installments_count}`,
              `*Monto abonado:* ${formatCurrency(amount)}`,
              amount < inst.expected_amount
                ? `*Saldo cuota:* ${formatCurrency(inst.expected_amount - amount)}`
                : `✅ Cuota cancelada`,
              `*Fecha de pago:* ${formatDate(date)}`,
              `─────────────────────────`,
              remaining > 0
                ? `Cuotas restantes: ${remaining}`
                : `🎉 ¡Plan de pago completado!`,
              ``,
              `Gracias por su pago 🙌`,
            ].filter(Boolean).join('\n');
            Share.share({ message: lines });
          }
        },
      ]
    );
  };

  const openEditModal = () => {
    if (!sale) return;
    setEditNotes(sale.notes ?? '');
    setEditPaymentDay(sale.payment_day.toString());
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    const day = parseInt(editPaymentDay);
    if (!day || day < 1 || day > 31) return Alert.alert('Inválido', 'El día de pago debe ser entre 1 y 31.');
    setSavingEdit(true);
    try {
      await updateSale(Number(id), { notes: editNotes.trim(), payment_day: day });
      setEditModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = () => setConfirmDelete(true);

  const confirmDoDelete = async () => {
    setDeleting(true);
    try {
      await deleteSale(Number(id));
      setConfirmDelete(false);
      router.back();
    } catch (e: any) {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
    }
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
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 4, marginRight: 4 }}>
            <TouchableOpacity onPress={openEditModal} style={{ padding: 6 }}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
            {sale.client_name ? (
              <TouchableOpacity onPress={() => router.push(`/client/${sale.client_id}`)} style={{ padding: 6 }}>
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>{sale.client_name}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ),
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
          {sale.notes ? (
            <View style={styles.notesRow}>
              <Ionicons name="document-text-outline" size={13} color={colors.textDim} />
              <Text style={styles.notesText}>{sale.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Items */}
        {saleItems.length > 0 && (
          <View style={styles.itemsCard}>
            <Text style={styles.itemsTitle}>Productos vendidos</Text>
            {saleItems.map((it) => (
              <View key={it.id} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{it.product_name}</Text>
                  <Text style={styles.itemDetail}>{it.quantity} ud{it.quantity !== 1 ? 's' : ''} × {formatCurrency(it.unit_price)}</Text>
                </View>
                <Text style={styles.itemSubtotal}>{formatCurrency(it.quantity * it.unit_price)}</Text>
              </View>
            ))}
          </View>
        )}

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
            <View style={styles.instActions}>
              {inst.paid_amount > 0 && sale && (
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    generatePdfReceipt(sale, inst, inst.paid_amount, inst.paid_date ?? getTodayISO());
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="document-text-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
              )}
              <Ionicons name="pencil" size={14} color={colors.textDim} />
            </View>
          </TouchableOpacity>
        ))}

        {/* Share full summary */}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={async () => {
            let bizName = 'Mi Negocio';
            try {
              const { data } = await supabase.auth.getUser();
              bizName = data.user?.user_metadata?.business_name ?? 'Mi Negocio';
            } catch {}
            const paidCount = installments.filter(i => i.status === 'paid').length;
            const totalPaid = installments.reduce((acc, i) => acc + i.paid_amount, 0);
            const pending = installments.reduce((acc, i) => acc + Math.max(i.expected_amount - i.paid_amount, 0), 0);
            const lines = [
              `📋 *ESTADO DE CUENTA*`,
              `📌 ${bizName}`,
              `─────────────────────────`,
              `*Cliente:* ${sale.client_name}`,
              `*Producto/Servicio:* ${sale.product_name}`,
              `─────────────────────────`,
              `*Total venta:* ${formatCurrency(sale.total_amount)}`,
              `*Anticipo abonado:* ${formatCurrency(sale.advance_payment)}`,
              `*Cuota mensual:* ${formatCurrency(sale.installment_amount)} (día ${sale.payment_day})`,
              `─────────────────────────`,
              `*Cuotas pagas:* ${paidCount} de ${sale.installments_count}`,
              `*Total abonado:* ${formatCurrency(totalPaid)}`,
              `*Saldo pendiente:* ${formatCurrency(pending)}`,
              `─────────────────────────`,
              pending > 0 ? `📅 Próximo vencimiento: día ${sale.payment_day}` : `✅ ¡Deuda cancelada!`,
            ].join('\n');
            Share.share({ message: lines });
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={16} color={colors.primary} />
          <Text style={styles.shareBtnText}>Compartir estado de cuenta</Text>
        </TouchableOpacity>

        {/* Delete sale */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteBtnText}>Eliminar venta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Payment modal */}
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
              <TextInput
                style={styles.modalInput}
                value={formatInputNumber(payAmount)}
                onChangeText={v => setPayAmount(v.replace(/\D/g, ''))}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textDim}
                autoFocus
              />
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

      {/* Confirm delete modal */}
      <Modal visible={confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { borderRadius: 20, marginHorizontal: 24 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger + '22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="trash" size={24} color={colors.danger} />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 6 }]}>Eliminar venta</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                ¿Eliminar esta venta?{'\n'}Se borrarán también todas las cuotas.
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setConfirmDelete(false)} disabled={deleting}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.danger }, deleting && { opacity: 0.6 }]}
                onPress={confirmDoDelete}
                disabled={deleting}
              >
                {deleting
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <><Ionicons name="trash" size={15} color={colors.white} /><Text style={styles.modalConfirmText}>Eliminar</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit sale modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Editar venta</Text>
            <Text style={styles.modalLabel}>Día de pago (1-31)</Text>
            <View style={styles.modalInputWrapper}>
              <TextInput style={styles.modalInput} value={editPaymentDay} onChangeText={setEditPaymentDay} keyboardType="numeric" placeholderTextColor={colors.textDim} />
            </View>
            <Text style={styles.modalLabel}>Notas</Text>
            <View style={[styles.modalInputWrapper, { minHeight: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
              <TextInput style={[styles.modalInput, { textAlignVertical: 'top' }]} value={editNotes} onChangeText={setEditNotes} multiline placeholder="Observaciones, acuerdos especiales..." placeholderTextColor={colors.textDim} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, savingEdit && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={savingEdit}>
                <Text style={styles.modalConfirmText}>{savingEdit ? 'Guardando...' : 'Guardar'}</Text>
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
  dateRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: colors.textDim },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 8, backgroundColor: colors.bg, borderRadius: 8, padding: 8 },
  notesText: { fontSize: 12, color: colors.textMuted, flex: 1 },
  itemsCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12 },
  itemsTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border + '66' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemDetail: { fontSize: 12, color: colors.textDim, marginTop: 1 },
  itemSubtotal: { fontSize: 14, fontWeight: '700', color: colors.primary },
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
  instActions: { alignItems: 'center', gap: 8 },
  pdfBtn: { padding: 4, backgroundColor: colors.primary + '18', borderRadius: 7 },
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
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 16, padding: 14, borderRadius: 12,
    backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '33',
  },
  shareBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, padding: 14, borderRadius: 12,
    backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '33',
  },
  deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
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
