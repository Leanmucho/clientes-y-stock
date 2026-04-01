import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getExpenses, updateExpense, deleteExpense, getSuppliers, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, formatInputNumber } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { Expense, Supplier } from '../../types';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getExpenses(), getSuppliers()]).then(([expenses, sups]) => {
      if (!active) return;
      const exp = expenses.find(e => e.id === Number(id));
      if (exp) {
        setExpense(exp);
        setCategory(exp.category);
        setDescription(exp.description);
        setAmount(exp.amount.toString());
        setDate(exp.date);
        setPaymentMethod(exp.payment_method);
        setNotes(exp.notes ?? '');
        setSupplierId(exp.supplier_id);
        const sup = sups.find(s => s.id === exp.supplier_id);
        setSupplierName(sup?.name ?? '');
      }
      setSuppliers(sups);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]));

  const handleSave = async () => {
    if (!description.trim()) return Alert.alert('Falta información', 'Ingresá una descripción.');
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) return Alert.alert('Falta información', 'Ingresá un monto válido.');

    setSaving(true);
    try {
      await updateExpense(Number(id), {
        category, description: description.trim(),
        amount: amountNum, date, payment_method: paymentMethod,
        notes: notes.trim(), supplier_id: supplierId,
      });
      setExpense(prev => prev ? { ...prev, category, description, amount: amountNum, date, payment_method: paymentMethod, notes, supplier_id: supplierId, supplier_name: supplierName } : null);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteExpense(Number(id));
      setConfirmDelete(false);
      router.back();
    } catch (e: any) {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
    }
  };

  if (loading) return <Loading />;
  if (!expense) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Gasto no encontrado</Text></View>;

  return (
    <>
      <Stack.Screen options={{
        title: 'Detalle de Gasto',
        headerRight: () => (
          <TouchableOpacity onPress={() => setEditing(true)} style={{ padding: 6 }}>
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{expense.category}</Text>
            </View>
            {expense.payment_method && (
              <Text style={styles.methodBadge}>{expense.payment_method}</Text>
            )}
          </View>
          <Text style={styles.expDesc}>{expense.description}</Text>
          <Text style={styles.expAmount}>{formatCurrency(expense.amount)}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
            <Text style={styles.metaText}>{formatDate(expense.date)}</Text>
          </View>
          {expense.supplier_name && (
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={14} color={colors.textDim} />
              <Text style={styles.metaText}>{expense.supplier_name}</Text>
            </View>
          )}
          {expense.notes ? (
            <View style={styles.notesBox}>
              <Ionicons name="document-text-outline" size={13} color={colors.textDim} />
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDelete(true)} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteBtnText}>Eliminar gasto</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Editar gasto</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Categoría</Text>
              <View style={styles.categoryGrid}>
                {EXPENSE_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catBtn, category === cat && styles.catBtnActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Descripción</Text>
              <View style={styles.inputBox}>
                <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholderTextColor={colors.textDim} />
              </View>
              <Text style={styles.label}>Monto</Text>
              <View style={styles.inputBox}>
                <Text style={{ color: colors.textMuted, marginRight: 4 }}>$</Text>
                <TextInput style={styles.input} value={formatInputNumber(amount)} onChangeText={v => setAmount(v.replace(/\D/g, ''))} keyboardType="numeric" placeholderTextColor={colors.textDim} />
              </View>
              <Text style={styles.label}>Fecha</Text>
              <View style={styles.inputBox}>
                <TextInput style={styles.input} value={date} onChangeText={setDate} keyboardType="numeric" placeholderTextColor={colors.textDim} />
              </View>
              <Text style={styles.label}>Forma de pago</Text>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity key={m} style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]} onPress={() => setPaymentMethod(m)}>
                    <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Proveedor</Text>
              <TouchableOpacity style={styles.supplierBtn} onPress={() => setShowSupplierPicker(v => !v)}>
                <Text style={{ flex: 1, color: supplierId ? colors.text : colors.textDim, fontSize: 14 }}>
                  {supplierName || 'Sin proveedor'}
                </Text>
                {supplierId && (
                  <TouchableOpacity onPress={() => { setSupplierId(null); setSupplierName(''); }}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </TouchableOpacity>
                )}
                <Ionicons name={showSupplierPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
              </TouchableOpacity>
              {showSupplierPicker && (
                <View style={styles.supplierList}>
                  {suppliers.map(s => (
                    <TouchableOpacity key={s.id} style={[styles.supplierItem, supplierId === s.id && styles.supplierItemActive]}
                      onPress={() => { setSupplierId(s.id); setSupplierName(s.name); setShowSupplierPicker(false); }}>
                      <Text style={[styles.supplierItemText, supplierId === s.id && { color: colors.primary, fontWeight: '700' }]}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Text style={styles.label}>Notas</Text>
              <View style={[styles.inputBox, { minHeight: 60, alignItems: 'flex-start', paddingTop: 10 }]}>
                <TextInput style={[styles.input, { textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textDim} />
              </View>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>Guardar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Confirm delete */}
      <Modal visible={confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { borderRadius: 20, marginHorizontal: 24 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger + '22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="trash" size={24} color={colors.danger} />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>¿Eliminar gasto?</Text>
              <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>Esta acción no se puede deshacer.</Text>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(false)} disabled={deleting}>
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.danger }, deleting && { opacity: 0.6 }]} onPress={handleDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catBadge: { backgroundColor: colors.danger + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catBadgeText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  methodBadge: { color: colors.textDim, fontSize: 12, fontWeight: '600', backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  expDesc: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 },
  expAmount: { fontSize: 32, fontWeight: '800', color: colors.danger, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 14, color: colors.textMuted },
  notesBox: { flexDirection: 'row', gap: 6, backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginTop: 8 },
  notesText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '33' },
  deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  catBtnActive: { backgroundColor: colors.danger + '22', borderColor: colors.danger },
  catBtnText: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  catBtnTextActive: { color: colors.danger, fontWeight: '700' },
  inputBox: { backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  methodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  methodBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  methodBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  methodText: { fontSize: 12, color: colors.textDim, fontWeight: '600' },
  methodTextActive: { color: colors.primary, fontWeight: '700' },
  supplierBtn: { backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  supplierList: { backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  supplierItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  supplierItemActive: { backgroundColor: colors.primary + '11' },
  supplierItemText: { fontSize: 14, color: colors.text },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
});
