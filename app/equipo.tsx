import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, RefreshControl, Linking,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember } from '../lib/database';
import { colors } from '../lib/colors';
import { Loading } from '../components/Loading';
import { TeamMember } from '../types';
import { formatInputNumber } from '../lib/utils';

const ROLES = ['Vendedor', 'Cobrador', 'Administrativo', 'Repositor', 'Encargado', 'Otro'];

export default function EquipoScreen() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [phone, setPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [active, setActive] = useState(true);

  useFocusEffect(useCallback(() => {
    let act = true;
    setLoading(true);
    getTeamMembers().then(data => {
      if (!act) return;
      setMembers(data);
      setLoading(false);
    });
    return () => { act = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await getTeamMembers();
    setMembers(data);
    setRefreshing(false);
  }, []);

  const openNew = () => {
    setEditMember(null);
    setName(''); setRole(ROLES[0]); setPhone(''); setCommissionRate(''); setActive(true);
    setShowForm(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setName(m.name); setRole(m.role || ROLES[0]); setPhone(m.phone || '');
    setCommissionRate(m.commission_rate?.toString() || ''); setActive(m.active);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Falta información', 'Ingresá el nombre.');
    const rate = commissionRate ? parseFloat(commissionRate) : 0;
    setSaving(true);
    try {
      const data = { name: name.trim(), role, phone: phone.trim(), commission_rate: rate, active };
      if (editMember) {
        await updateTeamMember(editMember.id, data);
        setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...data } : m));
      } else {
        const id = await createTeamMember(data);
        const newMember: TeamMember = { id, ...data, created_at: new Date().toISOString() };
        setMembers(prev => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setShowForm(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteTeamMember(confirmDelete.id);
      setMembers(prev => prev.filter(m => m.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loading />;

  const activeCount = members.filter(m => m.active).length;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Equipo',
          headerRight: () => (
            <TouchableOpacity onPress={openNew} style={{ padding: 6 }}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{members.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: colors.success }]}>
              <Text style={[styles.summaryNum, { color: colors.success }]}>{activeCount}</Text>
              <Text style={styles.summaryLabel}>Activos</Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: colors.textDim }]}>
              <Text style={[styles.summaryNum, { color: colors.textDim }]}>{members.length - activeCount}</Text>
              <Text style={styles.summaryLabel}>Inactivos</Text>
            </View>
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={44} color={colors.textDim} />
              <Text style={styles.emptyTitle}>Sin miembros del equipo</Text>
              <Text style={styles.emptySubtitle}>Tocá + para agregar el primer miembro</Text>
            </View>
          ) : (
            members.map(m => (
              <TouchableOpacity key={m.id} style={styles.memberCard} onPress={() => openEdit(m)} activeOpacity={0.75}>
                <View style={[styles.avatar, !m.active && { opacity: 0.4 }]}>
                  <Text style={styles.avatarText}>{m.name[0].toUpperCase()}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.memberName, !m.active && { color: colors.textDim }]}>{m.name}</Text>
                    {!m.active && <Text style={styles.inactiveBadge}>Inactivo</Text>}
                  </View>
                  <Text style={styles.memberRole}>{m.role}</Text>
                  {m.phone ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${m.phone}`)} style={styles.phoneRow}>
                      <Ionicons name="call-outline" size={11} color={colors.primary} />
                      <Text style={styles.phoneText}>{m.phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.rightCol}>
                  {m.commission_rate > 0 && (
                    <View style={styles.commBadge}>
                      <Text style={styles.commText}>{m.commission_rate}%</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => setConfirmDelete(m)} style={styles.deleteIcon}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Add/Edit modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editMember ? 'Editar miembro' : 'Nuevo miembro'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nombre *</Text>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={14} color={colors.textDim} />
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre completo" placeholderTextColor={colors.textDim} autoCapitalize="words" />
              </View>

              <Text style={styles.label}>Rol</Text>
              <View style={styles.roleGrid}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r} style={[styles.roleBtn, role === r && styles.roleBtnActive]} onPress={() => setRole(r)}>
                    <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Teléfono</Text>
              <View style={styles.inputBox}>
                <Ionicons name="call-outline" size={14} color={colors.textDim} />
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+54 9 11 ..." placeholderTextColor={colors.textDim} keyboardType="phone-pad" />
              </View>

              <Text style={styles.label}>Comisión (%)</Text>
              <View style={styles.inputBox}>
                <Ionicons name="pricetag-outline" size={14} color={colors.textDim} />
                <TextInput style={styles.input} value={commissionRate} onChangeText={setCommissionRate} placeholder="Ej: 5.5" placeholderTextColor={colors.textDim} keyboardType="decimal-pad" />
                <Text style={{ color: colors.textDim }}>%</Text>
              </View>

              <View style={styles.activeRow}>
                <Text style={styles.activeLabel}>Miembro activo</Text>
                <TouchableOpacity
                  style={[styles.toggle, active && styles.toggleActive]}
                  onPress={() => setActive(v => !v)}
                >
                  <View style={[styles.toggleKnob, active && styles.toggleKnobActive]} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
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
      <Modal visible={!!confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { borderRadius: 20, marginHorizontal: 24 }]}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger + '22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="trash" size={24} color={colors.danger} />
              </View>
              <Text style={[styles.modalTitle, { textAlign: 'center' }]}>¿Eliminar {confirmDelete?.name}?</Text>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(null)} disabled={deleting}>
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

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderTopWidth: 3, borderTopColor: colors.primary, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: colors.textDim, fontSize: 13 },
  memberCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { fontSize: 15, fontWeight: '700', color: colors.text },
  inactiveBadge: { fontSize: 10, color: colors.textDim, backgroundColor: colors.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  memberRole: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  phoneText: { fontSize: 12, color: colors.primary },
  rightCol: { alignItems: 'flex-end', gap: 8 },
  commBadge: { backgroundColor: colors.success + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  commText: { fontSize: 12, color: colors.success, fontWeight: '700' },
  deleteIcon: { padding: 4 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 14 },
  inputBox: { backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  roleBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  roleBtnText: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  roleBtnTextActive: { color: colors.primary, fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 8 },
  activeLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { backgroundColor: colors.success },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white, alignSelf: 'flex-start' },
  toggleKnobActive: { alignSelf: 'flex-end' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
});
