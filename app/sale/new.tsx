import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createSale, createInstallments, getProducts } from '../../lib/database';
import { Product } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, getTodayISO, generateInstallmentDates } from '../../lib/utils';

export default function NewSaleScreen() {
  const router = useRouter();
  const { clientId, clientName } = useLocalSearchParams<{ clientId: string; clientName: string }>();

  const [productName, setProductName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [totalAmount, setTotalAmount] = useState('');
  const [advancePayment, setAdvancePayment] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('');
  const [paymentDay, setPaymentDay] = useState('10');
  const [startDate, setStartDate] = useState(getTodayISO());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    getProducts().then(setProducts);
  }, []);

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductName(p.name);
    setTotalAmount(p.price > 0 ? p.price.toString() : '');
    setShowProductModal(false);
  };

  const clearProduct = () => {
    setSelectedProduct(null);
    setProductName('');
    setTotalAmount('');
  };

  const total = parseFloat(totalAmount) || 0;
  const advance = parseFloat(advancePayment) || 0;
  const count = parseInt(installmentsCount) || 0;
  const remaining = total - advance;
  const installmentAmount = count > 0 ? remaining / count : 0;
  const previewDates = count > 0 && paymentDay
    ? generateInstallmentDates(startDate, parseInt(paymentDay), Math.min(count, 3))
    : [];

  const handleSave = async () => {
    if (!productName.trim()) return Alert.alert('Requerido', 'Ingresá el nombre del producto.');
    if (total <= 0) return Alert.alert('Requerido', 'Ingresá el monto total.');
    if (count <= 0) return Alert.alert('Requerido', 'Ingresá la cantidad de cuotas.');
    const day = parseInt(paymentDay);
    if (!day || day < 1 || day > 31) return Alert.alert('Inválido', 'El día de pago debe ser entre 1 y 31.');
    if (selectedProduct && selectedProduct.stock <= 0) {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert('Sin stock', `${selectedProduct.name} no tiene stock disponible. ¿Registrar la venta igual?`, [
          { text: 'Cancelar', onPress: () => resolve(false) },
          { text: 'Sí, registrar', onPress: () => resolve(true) },
        ]);
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const saleId = await createSale({
        client_id: Number(clientId),
        product_id: selectedProduct?.id ?? null,
        product_name: productName.trim(),
        total_amount: total,
        advance_payment: advance,
        installments_count: count,
        installment_amount: installmentAmount,
        payment_day: day,
        start_date: startDate,
        delivery_date: deliveryDate,
      });
      const dates = generateInstallmentDates(startDate, day, count);
      await createInstallments(dates.map((date, i) => ({
        sale_id: saleId,
        installment_number: i + 1,
        due_date: date,
        expected_amount: installmentAmount,
        paid_amount: 0,
        paid_date: null,
        status: 'pending' as const,
        notes: '',
      })));
      router.replace(`/sale/${saleId}`);
    } catch {
      Alert.alert('Error', 'No se pudo guardar la venta.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: clientName ? `Nueva compra — ${clientName}` : 'Nueva Venta' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {clientName ? (
          <View style={styles.clientBadge}>
            <Ionicons name="person-circle" size={18} color={colors.primary} />
            <Text style={styles.clientBadgeText}>{clientName}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>PRODUCTO</Text>

        {/* Product from stock */}
        {selectedProduct ? (
          <View style={styles.selectedProduct}>
            <View style={styles.selectedInfo}>
              <Ionicons name="cube" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedName}>{selectedProduct.name}</Text>
                <Text style={styles.selectedStock}>
                  Stock disponible: <Text style={{ color: selectedProduct.stock > 0 ? colors.success : colors.danger, fontWeight: '700' }}>{selectedProduct.stock} uds</Text>
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={clearProduct}>
              <Ionicons name="close-circle" size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.fromStockBtn} onPress={() => setShowProductModal(true)}>
            <Ionicons name="cube-outline" size={16} color={colors.primary} />
            <Text style={styles.fromStockText}>Seleccionar del stock</Text>
          </TouchableOpacity>
        )}

        <Field icon="bag" label="Nombre del producto *" value={productName} onChangeText={setProductName}
          placeholder="Ej: Enova Tab10 4G" autoCapitalize="words" />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>MONTOS</Text>
        <Field icon="cash" label="Precio total *" value={totalAmount} onChangeText={setTotalAmount} placeholder="Ej: 35000" keyboardType="numeric" prefix="$" />
        <Field icon="wallet" label="Anticipo" value={advancePayment} onChangeText={setAdvancePayment} placeholder="0" keyboardType="numeric" prefix="$" />

        {total > 0 && (
          <View style={styles.summaryBox}>
            <SRow label="Total" value={formatCurrency(total)} />
            <SRow label="Anticipo" value={formatCurrency(advance)} />
            <View style={styles.divider} />
            <SRow label="Saldo a financiar" value={formatCurrency(remaining)} highlight />
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PLAN DE CUOTAS</Text>
        <Field icon="layers" label="Cantidad de cuotas *" value={installmentsCount} onChangeText={setInstallmentsCount} placeholder="Ej: 12" keyboardType="numeric" />
        <Field icon="calendar" label="Día de pago (1-31)" value={paymentDay} onChangeText={setPaymentDay} placeholder="Ej: 10" keyboardType="numeric" />

        {installmentAmount > 0 && (
          <View style={styles.installmentPreview}>
            <View style={styles.previewHeader}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.previewTitle}>Resumen del plan</Text>
            </View>
            <Text style={styles.previewAmount}>
              {count} cuotas de <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatCurrency(installmentAmount)}</Text>
            </Text>
            <View style={styles.datesPreview}>
              {previewDates.map((d, i) => (
                <View key={i} style={styles.dateChip}>
                  <Text style={styles.dateChipText}>Cuota {i + 1}: {d.split('-').reverse().join('/')}</Text>
                </View>
              ))}
              {count > 3 && <Text style={styles.moreDates}>... y {count - 3} cuotas más</Text>}
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>FECHAS</Text>
        <Field icon="today" label="Fecha de inicio (AAAA-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="Ej: 2025-03-11" keyboardType="numeric" />
        <Field icon="cube" label="Fecha de entrega (AAAA-MM-DD)" value={deliveryDate} onChangeText={setDeliveryDate} placeholder="Opcional" keyboardType="numeric" />

        <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Registrar Venta'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Product picker modal */}
      <Modal visible={showProductModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Seleccionar producto</Text>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>Sin productos en stock</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.productRow} onPress={() => selectProduct(item)} activeOpacity={0.7}>
                  <View style={styles.productRowInfo}>
                    <Text style={styles.productRowName}>{item.name}</Text>
                    <Text style={styles.productRowPrice}>{formatCurrency(item.price)}</Text>
                  </View>
                  <View style={[styles.stockPill, { backgroundColor: item.stock > 0 ? colors.success + '22' : colors.danger + '22' }]}>
                    <Text style={[styles.stockPillText, { color: item.stock > 0 ? colors.success : colors.danger }]}>
                      {item.stock} uds
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowProductModal(false)}>
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize, prefix }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={16} color={colors.textDim} style={{ marginRight: 8 }} />
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.textDim} keyboardType={keyboardType ?? 'default'} autoCapitalize={autoCapitalize ?? 'none'} />
      </View>
    </View>
  );
}

function SRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight && { color: colors.warning, fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  clientBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '22', borderRadius: 10, padding: 10, marginBottom: 16 },
  clientBadgeText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  fromStockBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '15', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.primary + '33' },
  fromStockText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  selectedProduct: { backgroundColor: colors.primary + '15', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.primary + '33' },
  selectedInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedName: { fontSize: 14, fontWeight: '700', color: colors.text },
  selectedStock: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  inputWrapper: { backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  prefix: { color: colors.textMuted, fontSize: 15, marginRight: 4 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  summaryBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  installmentPreview: { backgroundColor: colors.primary + '15', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.primary + '44' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  previewAmount: { fontSize: 14, color: colors.text, marginBottom: 8 },
  datesPreview: { gap: 4 },
  dateChip: { backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  dateChipText: { fontSize: 12, color: colors.textMuted },
  moreDates: { fontSize: 12, color: colors.textDim, fontStyle: 'italic', marginTop: 2 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 16 },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  productRowInfo: { flex: 1 },
  productRowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  productRowPrice: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 2 },
  stockPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stockPillText: { fontSize: 12, fontWeight: '700' },
  modalClose: { backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  modalCloseText: { color: colors.textMuted, fontWeight: '700' },
});
