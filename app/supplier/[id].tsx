import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Linking,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSupplier, updateSupplier, deleteSupplier, getExpensesBySupplier } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { Supplier, Expense } from '../../types';

export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSupplier(Number(id)), getExpensesBySupplier(Number(id))]).then(([s, exps]) => {
      if (!active) return;
      if (s) {
        setSupplier(s);
        setName(s.name);
        setContactName(s.contact_name ?? '');
        setPhone(s.phone ?? '');
        setEmail(s.email ?? '');
        setAddress(s.address ?? '');
        setCategory(s.category ?? '');
        setNotes(s.notes ?? '');
      }
      setExpenses(exps);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]));

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Falta información', 'El nombre es requerido.');
    setSaving(true);
    try {
      await updateSupplier(Number(id), {
        name: name.trim(), contact_name: contactName.trim(), phone: phone.trim(),
        email: email.trim(), address: address.trim(), category: category.trim(), notes: notes.trim(),
      });
      setSupplier(prev => prev ? { ...prev, name, contact_name: contactName, phone, email, address, category, notes } : null);
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
      await deleteSupplier(Number(id));
      setConfirmDelete(false);
      router.back();
    } catch (e: any) {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
    }
  };

  const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);

  if (loading) return <Loading />;
  if (!supplier) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Proveedor no encontrado</Text></View>;

  return (
    <>
      <Stack.Screen options={{
        title: supplier.name,
        headerRight: () => (
          <TouchableOpacity onPress={() => setEditing(true)} style={{ padding: 6 }}>
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Info card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{supplier.name[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supplierName}>{supplier.name}</Text>
              {supplier.category ? <Text style={styles.supplierCategory}>{supplier.category}</Text> : null}
            </View>
          </View>

          {supplier.contact_name ? <InfoRow icon="person-outline" text={supplier.contact_name} /> : null}
          {supplier.phone ? (
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${supplier.phone}`)}>
              <InfoRow icon="call-outline" text={supplier.phone} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          {supplier.email ? (
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${supplier.email}`)}>
              <InfoRow icon="mail-outline" text={supplier.email} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
          {supplier.address ? <InfoRow icon="location-outline" text={supplier.address} /> : null}
          {supplier.notes ? (
            <View style={styles.notesBox}>
              <Ionicons name="document-text-outline" size={13} color={colors.textDim} />
              <Text style={styles.notesText}>{supplier.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{expenses.length}</Text>
            <Text style={styles.statLabel}>Gastos registrados</Text>
          </View>
          <View style={[styles.statCard, { borderTopColor: colors.danger }]}>
            <Text style={[styles.statValue, { color: colors.danger }]}>{formatCurrency(totalSpent)}</Text>
            <Text style={styles.statLabel}>Total gastado</Text>
          </View>
        </View>

        {/* Expenses list */}
        <Text style={styles.sectionTitle}>Gastos de este proveedor</Text>
        {expenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Sin gastos registrados</Text>
          </View>
        ) : (
          expenses.slice(0, 10).map(exp => (
            <TouchableOpacity key={exp.id} style={styles.expRow} onPress={() => router.push(`/expense/${exp.id}` as any)} activeOpacity={0.75}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expDesc} numberOfLines={1}>{exp.description}</Text>
                <Text style={styles.expMeta}>{exp.category} · {formatDate(exp.date)}</Text>
              </View>
              <Text style={styles.expAmount}>{formatCurrency(exp.amount)}</Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmDelete(true)} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteBtnText}>Eliminar proveedor</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Editar proveedor</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Nombre *', value: name, set: setName, icon: 'business-outline', cap: 'words' },
                { label: 'Contacto', value: contactName, set: setContactName, icon: 'person-outline', cap: 'words' },
                { label: 'Teléfono', value: phone, set: setPhone, icon: 'call-outline', keyboard: 'phone-pad', cap: 'none' },
                { label: 'Email', value: email, set: setEmail, icon: 'mail-outline', keyboard: 'email-address', cap: 'none' },
                { label: 'Dirección', value: address, set: setAddress, icon: 'location-outline', cap: 'words' },
                { label: 'Rubro', value: category, set: setCategory, icon: 'pricetag-outline', cap: 'sentences' },
              ].map(({ label, value, set, icon, keyboard, cap }) => (
                <View key={label}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name={icon as any} size={14} color={colors.textDim} />
                    <TextInput style={styles.input} value={value} onChangeText={set} placeholderTextColor={colors.textDim} keyboardType={keyboard as any ?? 'default'} autoCapitalize={cap as any ?? 'sentences'} />
                  </View>
                </View>
              ))}
              <Text style={styles.fieldLabel}>Notas</Text>
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
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>¿Eliminar proveedor?</Text>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(false)} disabled={deleting}>
                <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.danger }, deleting && { opacity: 0.6 }]} onPress={handleDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={{ color: colors.white, fontWeight: '700' }}>Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function InfoRow({ icon, text, color }: { icon: any; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Ionicons name={icon} size={15} color={color ?? colors.textDim} />
      <Text style={{ fontSize: 14, color: color ?? colors.textMuted, flex: 1 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.primary },
  supplierName: { fontSize: 18, fontWeight: '800', color: colors.text },
  supplierCategory: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  notesBox: { flexDirection: 'row', gap: 6, backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginTop: 8 },
  notesText: { flex: 1, fontSize: 13, color: colors.textMuted },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderTopWidth: 3, borderTopColor: colors.primary },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 14 },
  expRow: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  expDesc: { fontSize: 14, fontWeight: '600', color: colors.text },
  expMeta: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  expAmount: { fontSize: 14, fontWeight: '700', color: colors.danger },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '33', marginTop: 20 },
  deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 6, marginTop: 12 },
  inputBox: { backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
});
