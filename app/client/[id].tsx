import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getClient, updateClient, deleteClient,
  getSalesByClient, getClientPayments,
  getClientPendingDebt, registerAdvancePayment, getClientDataForExport,
} from '../../lib/database';
import { Client, Sale, ClientPayment } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, formatInputNumber, getTodayISO, getStatusLabel } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { downloadFile } from '../../lib/download';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [pendingDebt, setPendingDebt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Advance payment modal
  const [payModal, setPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payNotes, setPayNotes] = useState('');
  const [registering, setRegistering] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDni, setEditDni] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editZone, setEditZone] = useState('');
  const [editReference, setEditReference] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const clientId = Number(id);
    const [c, s, p, debt] = await Promise.all([
      getClient(clientId),
      getSalesByClient(clientId),
      getClientPayments(clientId),
      getClientPendingDebt(clientId),
    ]);
    setClient(c); setSales(s); setPayments(p); setPendingDebt(debt);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    const clientId = Number(id);
    Promise.all([
      getClient(clientId), getSalesByClient(clientId),
      getClientPayments(clientId), getClientPendingDebt(clientId),
    ]).then(([c, s, p, debt]) => {
      if (!active) return;
      setClient(c); setSales(s); setPayments(p); setPendingDebt(debt);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const openPayModal = () => {
    setPayAmount(''); setPayDate(getTodayISO()); setPayNotes('');
    setPayModal(true);
  };

  const openEditModal = () => {
    if (!client) return;
    setEditName(client.name);
    setEditDni(client.dni);
    setEditPhone(client.phone);
    setEditAddress(client.address);
    setEditZone(client.zone ?? '');
    setEditReference(client.reference);
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return Alert.alert('Requerido', 'El nombre es obligatorio.');
    setSavingEdit(true);
    try {
      await updateClient(Number(id), {
        name: editName.trim(),
        dni: editDni.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim(),
        zone: editZone.trim(),
        reference: editReference.trim(),
      });
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
      await deleteClient(Number(id));
      setConfirmDelete(false);
      router.back();
    } catch (e: any) {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
    }
  };

  const handleRegisterPayment = async () => {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return Alert.alert('Inválido', 'Ingresá un monto mayor a 0.');
    if (amount > pendingDebt + 1) {
      const ok = await new Promise<boolean>(resolve => {
        Alert.alert(
          'Monto mayor a la deuda',
          `La deuda pendiente es ${formatCurrency(pendingDebt)}. ¿Registrar igual?`,
          [{ text: 'Cancelar', onPress: () => resolve(false) }, { text: 'Sí', onPress: () => resolve(true) }]
        );
      });
      if (!ok) return;
    }
    setRegistering(true);
    try {
      await registerAdvancePayment(Number(id), amount, payDate, payNotes.trim());
      setPayModal(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo registrar el pago.');
    } finally {
      setRegistering(false);
    }
  };

  const handleExportClient = async () => {
    if (!client) return;
    setExporting(true);
    try {
      const { sales: allSales, installments, payments: allPayments } = await getClientDataForExport(client.id);
      const lines: string[] = [];
      const sep = '═'.repeat(48);
      const div = '─'.repeat(48);

      lines.push(sep);
      lines.push(`ESTADO DE CUENTA — ${client.name.toUpperCase()}`);
      lines.push(sep);
      if (client.dni) lines.push(`DNI: ${client.dni}`);
      if (client.phone) lines.push(`Teléfono: ${client.phone}`);
      if (client.address) lines.push(`Dirección: ${client.address}`);
      if (client.zone) lines.push(`Zona: ${client.zone}`);
      lines.push(`Generado: ${formatDate(getTodayISO())}`);
      lines.push('');

      lines.push('RESUMEN');
      lines.push(div);
      lines.push(`Compras: ${allSales.length}`);
      lines.push(`Deuda pendiente: ${formatCurrency(pendingDebt)}`);
      lines.push('');

      if ((allSales as any[]).length > 0) {
        lines.push('COMPRAS');
        lines.push(div);
        for (const s of allSales as any[]) {
          lines.push(`• ${s.product_name}`);
          lines.push(`  Total: ${formatCurrency(s.total_amount)}  |  Anticipo: ${formatCurrency(s.advance_payment)}`);
          lines.push(`  ${s.installments_count} cuotas de ${formatCurrency(s.installment_amount)} — día ${s.payment_day}`);
          lines.push(`  Inicio: ${formatDate(s.start_date)}`);
        }
        lines.push('');
      }

      if (installments.length > 0) {
        lines.push('CUOTAS');
        lines.push(div);
        for (const i of installments) {
          const status = getStatusLabel(i.status);
          const paid = i.paid_amount > 0 ? ` (pagado: ${formatCurrency(i.paid_amount)})` : '';
          lines.push(`Cuota ${i.installment_number} — ${formatDate(i.due_date)} — ${formatCurrency(i.expected_amount)}${paid} [${status}]`);
        }
        lines.push('');
      }

      if ((allPayments as any[]).length > 0) {
        lines.push('PAGOS REGISTRADOS');
        lines.push(div);
        for (const p of allPayments as any[]) {
          const notes = p.notes ? ` — ${p.notes}` : '';
          lines.push(`${formatDate(p.date)}: ${formatCurrency(p.amount)}${notes}`);
        }
      }

      const content = lines.join('\n');
      const slug = client.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await downloadFile(content, `estado-cuenta-${slug}.txt`, 'text/plain');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Loading />;
  if (!client) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Cliente no encontrado</Text></View>;

  return (
    <>
      <Stack.Screen options={{
        title: client.name,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: 4, marginRight: 4 }}>
            <TouchableOpacity onPress={openEditModal} style={styles.headerBtn}>
              <Ionicons name="pencil" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExportClient} disabled={exporting} style={styles.headerBtn}>
              {exporting
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="share-outline" size={20} color={colors.primary} />
              }
            </TouchableOpacity>
          </View>
        ),
      }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Client info */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.clientName}>{client.name}</Text>
            {client.dni ? <InfoRow icon="card-outline" text={client.dni} /> : null}
            {client.phone ? <InfoRow icon="call-outline" text={client.phone} /> : null}
            {client.address ? <InfoRow icon="location-outline" text={client.address} /> : null}
            {client.zone ? <InfoRow icon="map-outline" text={client.zone} /> : null}
            {client.reference ? <InfoRow icon="people-outline" text={client.reference} /> : null}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{sales.length}</Text>
            <Text style={styles.summaryLabel}>Compras</Text>
          </View>
          <View style={[styles.summaryCard, { borderTopColor: pendingDebt > 0 ? colors.warning : colors.success }]}>
            <Text style={[styles.summaryValue, { color: pendingDebt > 0 ? colors.warning : colors.success }]}>
              {formatCurrency(pendingDebt)}
            </Text>
            <Text style={styles.summaryLabel}>Deuda pendiente</Text>
          </View>
        </View>

        {/* Advance payment button */}
        {pendingDebt > 0 && (
          <TouchableOpacity style={styles.advancePayBtn} onPress={openPayModal} activeOpacity={0.8}>
            <Ionicons name="cash" size={20} color={colors.white} />
            <View style={{ flex: 1 }}>
              <Text style={styles.advancePayBtnTitle}>Registrar pago</Text>
              <Text style={styles.advancePayBtnSub}>Se aplicará a las cuotas pendientes</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.white + 'aa'} />
          </TouchableOpacity>
        )}

        {/* Sales */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Compras</Text>
          <TouchableOpacity
            style={styles.addSaleButton}
            onPress={() => router.push({ pathname: '/sale/new', params: { clientId: client.id, clientName: client.name } })}
          >
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

        {/* Payment history */}
        {payments.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 10 }]}>Historial de pagos</Text>
            {payments.map((p) => (
              <View key={p.id} style={styles.paymentHistoryRow}>
                <View style={styles.paymentHistoryIcon}>
                  <Ionicons name="cash-outline" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentHistoryAmount}>{formatCurrency(p.amount)}</Text>
                  <Text style={styles.paymentHistoryDate}>{formatDate(p.date)}</Text>
                  {p.notes ? <Text style={styles.paymentHistoryNotes}>{p.notes}</Text> : null}
                </View>
                <View style={styles.paymentHistoryBadge}>
                  <Text style={styles.paymentHistoryBadgeText}>Pago</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Delete button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteBtnText}>Eliminar cliente</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Advance payment modal */}
      <Modal visible={payModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Registrar pago de {client.name}</Text>

            {pendingDebt > 0 && (
              <View style={styles.debtInfo}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textDim} />
                <Text style={styles.debtInfoText}>
                  Deuda pendiente: <Text style={{ color: colors.warning, fontWeight: '700' }}>{formatCurrency(pendingDebt)}</Text>
                </Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Monto</Text>
            <View style={styles.modalInputRow}>
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

            <Text style={styles.modalLabel}>Fecha (AAAA-MM-DD)</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                value={payDate}
                onChangeText={setPayDate}
                keyboardType="numeric"
                placeholder={getTodayISO()}
                placeholderTextColor={colors.textDim}
              />
            </View>

            <Text style={styles.modalLabel}>Notas (opcional)</Text>
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                value={payNotes}
                onChangeText={setPayNotes}
                placeholder="Ej: Pagó en efectivo"
                placeholderTextColor={colors.textDim}
              />
            </View>

            <View style={styles.modalHint}>
              <Ionicons name="information-circle" size={14} color={colors.primary} />
              <Text style={styles.modalHintText}>El pago se aplicará automáticamente a las cuotas más antiguas primero.</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setPayModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, registering && { opacity: 0.6 }]}
                onPress={handleRegisterPayment}
                disabled={registering}
              >
                {registering
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <>
                      <Ionicons name="checkmark-circle" size={16} color={colors.white} />
                      <Text style={styles.modalConfirmText}>Registrar</Text>
                    </>
                }
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
              <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 6 }]}>Eliminar cliente</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
                ¿Eliminar a <Text style={{ fontWeight: '700', color: colors.text }}>{client?.name}</Text>?{'\n'}Se borrarán todas sus ventas y cuotas.
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

      {/* Edit client modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalSheet, { paddingBottom: 40 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Editar cliente</Text>

              {[
                { label: 'Nombre *', value: editName, set: setEditName, cap: 'words' as const },
                { label: 'DNI', value: editDni, set: setEditDni, kb: 'numeric' as const },
                { label: 'Celular', value: editPhone, set: setEditPhone, kb: 'phone-pad' as const },
                { label: 'Domicilio', value: editAddress, set: setEditAddress, cap: 'words' as const },
                { label: 'Zona / Barrio', value: editZone, set: setEditZone, cap: 'words' as const },
                { label: 'Referencia', value: editReference, set: setEditReference, cap: 'words' as const },
              ].map(({ label, value, set, kb, cap }) => (
                <View key={label} style={{ marginBottom: 10 }}>
                  <Text style={styles.modalLabel}>{label}</Text>
                  <View style={styles.modalInputRow}>
                    <TextInput
                      style={styles.modalInput}
                      value={value}
                      onChangeText={set}
                      keyboardType={kb ?? 'default'}
                      autoCapitalize={cap ?? 'none'}
                      placeholderTextColor={colors.textDim}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, savingEdit && { opacity: 0.6 }]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={styles.modalConfirmText}>Guardar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  headerBtn: { padding: 6 },
  headerCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', gap: 14, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: colors.primary },
  headerInfo: { flex: 1 },
  clientName: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  infoText: { fontSize: 13, color: colors.textMuted },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', borderTopWidth: 3, borderTopColor: colors.primary },
  summaryValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  advancePayBtn: {
    backgroundColor: colors.success, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  advancePayBtnTitle: { color: colors.white, fontWeight: '700', fontSize: 15 },
  advancePayBtnSub: { color: colors.white + 'cc', fontSize: 11, marginTop: 1 },
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
  paymentHistoryRow: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  paymentHistoryIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.success + '22', justifyContent: 'center', alignItems: 'center' },
  paymentHistoryAmount: { fontSize: 16, fontWeight: '800', color: colors.success },
  paymentHistoryDate: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  paymentHistoryNotes: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  paymentHistoryBadge: { backgroundColor: colors.success + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  paymentHistoryBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 24, padding: 14, borderRadius: 12,
    backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '33',
  },
  deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 16 },
  debtInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 10, padding: 10, marginBottom: 16 },
  debtInfoText: { fontSize: 13, color: colors.textMuted },
  modalLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginLeft: 2 },
  modalInputRow: {
    backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  modalPrefix: { color: colors.textMuted, fontSize: 16, marginRight: 4 },
  modalInput: { flex: 1, color: colors.text, fontSize: 16 },
  modalHint: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginBottom: 16, backgroundColor: colors.primary + '15', borderRadius: 10, padding: 10 },
  modalHintText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: colors.textMuted, fontWeight: '700' },
  modalConfirm: { flex: 2, backgroundColor: colors.success, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  modalConfirmText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
