import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createExpense, EXPENSE_CATEGORIES, PAYMENT_METHODS, getSuppliers } from '../../lib/database';
import { colors } from '../../lib/colors';
import { getTodayISO, formatInputNumber } from '../../lib/utils';
import { Supplier } from '../../types';

export default function NewExpenseScreen() {
  const router = useRouter();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState('');
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    getSuppliers().then(setSuppliers);
  }, []));

  const handleSave = async () => {
    if (!description.trim()) return Alert.alert('Falta información', 'Ingresá una descripción.');
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) return Alert.alert('Falta información', 'Ingresá un monto válido.');
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');

    setSaving(true);
    try {
      await createExpense({
        category,
        description: description.trim(),
        amount: amountNum,
        date,
        payment_method: paymentMethod,
        notes: notes.trim(),
        supplier_id: supplierId,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Nuevo Gasto', presentation: 'modal' }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>

          {/* Category */}
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.categoryGrid}>
            {EXPENSE_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catBtn, category === cat && styles.catBtnActive]}
                onPress={() => setCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={styles.label}>Descripción *</Text>
          <View style={styles.inputBox}>
            <Ionicons name="document-text-outline" size={16} color={colors.textDim} />
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: Pago alquiler local"
              placeholderTextColor={colors.textDim}
              autoCapitalize="sentences"
            />
          </View>

          {/* Amount */}
          <Text style={styles.label}>Monto *</Text>
          <View style={styles.inputBox}>
            <Text style={styles.prefix}>$</Text>
            <TextInput
              style={styles.input}
              value={formatInputNumber(amount)}
              onChangeText={v => setAmount(v.replace(/\D/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
            />
          </View>

          {/* Date */}
          <Text style={styles.label}>Fecha (AAAA-MM-DD)</Text>
          <View style={styles.inputBox}>
            <Ionicons name="calendar-outline" size={16} color={colors.textDim} />
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2025-01-01"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
            />
          </View>

          {/* Payment method */}
          <Text style={styles.label}>Forma de pago</Text>
          <View style={styles.methodRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.methodBtn, paymentMethod === m && styles.methodBtnActive]}
                onPress={() => setPaymentMethod(m)}
              >
                <Text style={[styles.methodText, paymentMethod === m && styles.methodTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Supplier */}
          <Text style={styles.label}>Proveedor (opcional)</Text>
          <TouchableOpacity
            style={styles.supplierBtn}
            onPress={() => setShowSupplierPicker(v => !v)}
            activeOpacity={0.8}
          >
            <Ionicons name="business-outline" size={16} color={colors.textDim} />
            <Text style={[styles.supplierBtnText, supplierId && { color: colors.text }]}>
              {supplierName || 'Seleccionar proveedor'}
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
              {suppliers.length === 0 ? (
                <Text style={styles.supplierEmpty}>Sin proveedores. Agregá uno en Más → Proveedores.</Text>
              ) : (
                suppliers.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.supplierItem, supplierId === s.id && styles.supplierItemActive]}
                    onPress={() => { setSupplierId(s.id); setSupplierName(s.name); setShowSupplierPicker(false); }}
                  >
                    <Ionicons name="business" size={14} color={supplierId === s.id ? colors.primary : colors.textDim} />
                    <Text style={[styles.supplierItemText, supplierId === s.id && { color: colors.primary, fontWeight: '700' }]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Notes */}
          <Text style={styles.label}>Notas (opcional)</Text>
          <View style={[styles.inputBox, { minHeight: 70, alignItems: 'flex-start', paddingTop: 10 }]}>
            <TextInput
              style={[styles.input, { textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observaciones adicionales..."
              placeholderTextColor={colors.textDim}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={colors.white} size="small" />
              : <><Ionicons name="checkmark-circle" size={20} color={colors.white} /><Text style={styles.saveBtnText}>Guardar gasto</Text></>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  catBtnActive: { backgroundColor: colors.danger + '22', borderColor: colors.danger },
  catBtnText: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  catBtnTextActive: { color: colors.danger, fontWeight: '700' },
  inputBox: { backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  prefix: { color: colors.textMuted, fontSize: 16 },
  methodRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  methodBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  methodBtnActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  methodText: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  methodTextActive: { color: colors.primary, fontWeight: '700' },
  supplierBtn: { backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  supplierBtnText: { flex: 1, color: colors.textDim, fontSize: 14 },
  supplierList: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden' },
  supplierEmpty: { padding: 14, color: colors.textDim, fontSize: 13, textAlign: 'center' },
  supplierItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  supplierItemActive: { backgroundColor: colors.primary + '11' },
  supplierItemText: { fontSize: 14, color: colors.text },
  saveBtn: { backgroundColor: colors.danger, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
