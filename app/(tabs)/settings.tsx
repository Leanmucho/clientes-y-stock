import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { exportAllData, getOverallStats } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/utils';
import { downloadFile, toCSV } from '../../lib/download';

export default function SettingsScreen() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [bizName, setBizName] = useState('');
  const [editingBiz, setEditingBiz] = useState(false);
  const [bizDraft, setBizDraft] = useState('');
  const [savingBiz, setSavingBiz] = useState(false);
  const [stats, setStats] = useState({ totalSold: 0, totalCollected: 0, totalPending: 0 });
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
      setBizName(data.user?.user_metadata?.business_name ?? 'Mi Negocio');
    });
    getOverallStats().then(setStats);
  }, []));

  const handleSaveBizName = async () => {
    if (!bizDraft.trim()) return;
    setSavingBiz(true);
    const { error } = await supabase.auth.updateUser({ data: { business_name: bizDraft.trim() } });
    setSavingBiz(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el nombre.');
    } else {
      setBizName(bizDraft.trim());
      setEditingBiz(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const date = new Date().toISOString().split('T')[0];
      await downloadFile(JSON.stringify(data, null, 2), `backup-${date}.json`, 'application/json');
      Alert.alert('Listo', 'Backup exportado correctamente.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportInstallments = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const headers = ['Cliente', 'Venta', 'Cuota #', 'Vencimiento', 'Monto esperado', 'Pagado', 'Estado', 'Notas'];
      const rows = data.installments.map((i: any) => [
        i.client_name,
        i.product_name,
        i.installment_number,
        i.due_date,
        i.expected_amount,
        i.paid_amount,
        i.status,
        i.notes,
      ]);
      const date = new Date().toISOString().split('T')[0];
      await downloadFile(toCSV(headers, rows), `cuotas-${date}.csv`, 'text/csv');
      Alert.alert('Listo', 'Reporte de cuotas exportado.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportClients = async () => {
    setExporting(true);
    try {
      const data = await exportAllData();
      const headers = ['Nombre', 'DNI', 'Teléfono', 'Dirección', 'Referencia'];
      const rows = (data.clients as any[]).map(c => [c.name, c.dni, c.phone, c.address, c.reference]);
      const date = new Date().toISOString().split('T')[0];
      await downloadFile(toCSV(headers, rows), `clientes-${date}.csv`, 'text/csv');
      Alert.alert('Listo', 'Lista de clientes exportada.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo exportar.');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try { await supabase.auth.signOut(); } catch {}
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        router.replace('/login');
      }
    };

    // Alert.alert en web usa window.alert() nativo que no soporta callbacks en botones
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('¿Cerrar sesión?')) {
        await doLogout();
      }
      return;
    }

    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CUENTA</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountEmail}>{userEmail || 'Usuario'}</Text>
              <Text style={styles.accountSub}>Sesión activa</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RESUMEN GENERAL</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total vendido" value={formatCurrency(stats.totalSold)} color={colors.primary} />
          <StatCard label="Total cobrado" value={formatCurrency(stats.totalCollected)} color={colors.success} />
          <StatCard label="Deuda pendiente" value={formatCurrency(stats.totalPending)} color={colors.warning} />
        </View>
      </View>

      {/* Gestión */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GESTIÓN</Text>
        <View style={styles.card}>
          <NavOption
            icon="bar-chart-outline"
            color={colors.primary}
            title="Reportes y análisis"
            subtitle="P&L, tendencias, categorías de gastos"
            onPress={() => router.push('/reportes')}
          />
          <View style={styles.divider} />
          <NavOption
            icon="business-outline"
            color={colors.success}
            title="Proveedores"
            subtitle="Gestión de proveedores y contactos"
            onPress={() => router.push('/proveedores')}
          />
          <View style={styles.divider} />
          <NavOption
            icon="people-outline"
            color={colors.warning}
            title="Equipo"
            subtitle="Miembros, roles y comisiones"
            onPress={() => router.push('/equipo')}
          />
          <View style={styles.divider} />
          <NavOption
            icon="navigate-outline"
            color={colors.textDim}
            title="Zonas y Rutas"
            subtitle="Cobros pendientes por zona"
            onPress={() => router.push('/zones')}
          />
        </View>
      </View>

      {/* Export */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>EXPORTAR DATOS</Text>
        <View style={styles.card}>
          {exporting && (
            <View style={styles.exportingRow}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.exportingText}>Exportando...</Text>
            </View>
          )}

          <ExportOption
            icon="cloud-download-outline"
            title="Backup completo"
            subtitle="Todos los datos en formato JSON"
            onPress={handleExportJSON}
            disabled={exporting}
          />
          <View style={styles.divider} />
          <ExportOption
            icon="document-text-outline"
            title="Reporte de cuotas"
            subtitle="Historial de pagos en CSV (Excel)"
            onPress={handleExportInstallments}
            disabled={exporting}
          />
          <View style={styles.divider} />
          <ExportOption
            icon="people-outline"
            title="Lista de clientes"
            subtitle="Nombre, DNI, teléfono, dirección en CSV"
            onPress={handleExportClients}
            disabled={exporting}
          />
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>INFORMACIÓN</Text>
        <View style={styles.card}>
          <InfoRow icon="storefront-outline" label="Aplicación" value="Clientes y Stock" />
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => { setBizDraft(bizName); setEditingBiz(true); }}
            activeOpacity={0.7}
          >
            <Ionicons name="business-outline" size={16} color={colors.textDim} />
            <Text style={styles.infoLabel}>Negocio</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{bizName}</Text>
            <Ionicons name="pencil-outline" size={14} color={colors.textDim} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <InfoRow icon="server-outline" label="Base de datos" value="Supabase Cloud" />
        </View>
      </View>

    </ScrollView>

    <Modal visible={editingBiz} transparent animationType="fade">
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>Nombre del negocio</Text>
          <View style={styles.modalInput}>
            <TextInput
              style={styles.modalTextField}
              value={bizDraft}
              onChangeText={setBizDraft}
              placeholder="Ej: Mi Distribuidora"
              placeholderTextColor={colors.textDim}
              autoFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveBizName}
            />
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingBiz(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSave, savingBiz && { opacity: 0.6 }]}
              onPress={handleSaveBizName}
              disabled={savingBiz}
            >
              {savingBiz
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.modalSaveText}>Guardar</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavOption({ icon, color, title, subtitle, onPress }: {
  icon: any; color: string; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.exportRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.exportIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exportTitle}>{title}</Text>
        <Text style={styles.exportSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
    </TouchableOpacity>
  );
}

function ExportOption({ icon, title, subtitle, onPress, disabled }: {
  icon: any; title: string; subtitle: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.exportRow, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.exportIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.exportTitle}>{title}</Text>
        <Text style={styles.exportSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
    </TouchableOpacity>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textDim} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  accountRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  accountIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' },
  accountEmail: { fontSize: 15, fontWeight: '700', color: colors.text },
  accountSub: { fontSize: 12, color: colors.success, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, borderTopWidth: 3 },
  statValue: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, color: colors.textMuted },
  exportingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.primary + '11' },
  exportingText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  exportRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  exportIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center' },
  exportTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  exportSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  infoLabel: { flex: 1, fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000077', padding: 24 },
  modalBox: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 16 },
  modalInput: { backgroundColor: colors.bg, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 },
  modalTextField: { color: colors.text, fontSize: 15 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 13, alignItems: 'center' },
  modalCancelText: { color: colors.textMuted, fontWeight: '700' },
  modalSave: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, padding: 13, alignItems: 'center' },
  modalSaveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
