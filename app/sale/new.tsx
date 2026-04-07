import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createSale, createInstallments, getProducts } from '../../lib/database';
import { Product } from '../../types';
import { colors } from '../../lib/colors';
import {
  formatCurrency, formatInputNumber, getTodayISO,
  generateInstallmentDates, generateWeeklyInstallmentDates, generateBiweeklyInstallmentDates,
} from '../../lib/utils';
import { DateInput } from '../../components/DateInput';
import { BottomSheet } from '../../components/BottomSheet';

type Frequency = 'monthly' | 'biweekly' | 'weekly';

const FREQ_OPTIONS: { key: Frequency; label: string; sublabel: string }[] = [
  { key: 'monthly', label: 'Mensual', sublabel: 'Cada mes' },
  { key: 'biweekly', label: 'Quincenal', sublabel: 'Cada 15 días' },
  { key: 'weekly', label: 'Semanal', sublabel: 'Cada 7 días' },
];

interface ItemForm {
  key: string;
  product: Product | null;
  productName: string;
  quantity: string;
  unitPrice: string;
}

let _keyCounter = 0;
const nextKey = () => String(++_keyCounter);

function getPreviewDates(frequency: Frequency, startDate: string, paymentDay: string, count: number): string[] {
  const n = Math.min(count, 3);
  if (n <= 0) return [];
  if (frequency === 'weekly') return generateWeeklyInstallmentDates(startDate, n);
  if (frequency === 'biweekly') return generateBiweeklyInstallmentDates(startDate, n);
  const day = parseInt(paymentDay);
  if (!day || day < 1 || day > 31) return [];
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !isNaN(new Date(startDate).getTime());
  if (!isValidDate) return [];
  return generateInstallmentDates(startDate, day, n);
}

export default function NewSaleScreen() {
  const router = useRouter();
  const { clientId, clientName } = useLocalSearchParams<{ clientId: string; clientName: string }>();

  const [items, setItems] = useState<ItemForm[]>([
    { key: nextKey(), product: null, productName: '', quantity: '1', unitPrice: '' },
  ]);
  const [advancePayment, setAdvancePayment] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [paymentDay, setPaymentDay] = useState('10');
  const [startDate, setStartDate] = useState(getTodayISO());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState<string | null>(null);

  useEffect(() => { getProducts().then(setProducts); }, []);

  const updateItem = (key: string, patch: Partial<ItemForm>) =>
    setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));

  const addItem = () =>
    setItems(prev => [...prev, { key: nextKey(), product: null, productName: '', quantity: '1', unitPrice: '' }]);

  const removeItem = (key: string) => {
    if (items.length === 1) return Alert.alert('', 'Debe haber al menos un producto.');
    setItems(prev => prev.filter(it => it.key !== key));
  };

  const selectProduct = (itemKey: string, p: Product) => {
    updateItem(itemKey, { product: p, productName: p.name, unitPrice: p.price > 0 ? p.price.toString() : '' });
    setShowProductModal(null);
  };

  const totalAmount = items.reduce((acc, it) => {
    return acc + (parseInt(it.quantity) || 1) * (parseFloat(it.unitPrice) || 0);
  }, 0);
  const advance = parseFloat(advancePayment) || 0;
  const count = parseInt(installmentsCount) || 0;
  const remaining = totalAmount - advance;
  const installmentAmount = count > 0 ? remaining / count : 0;

  const isValidStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !isNaN(new Date(startDate).getTime());
  const previewDates = count > 0 && isValidStartDate
    ? getPreviewDates(frequency, startDate, paymentDay, count)
    : [];

  const handleSave = async () => {
    const validItems = items.filter(it => it.productName.trim() && (parseFloat(it.unitPrice) || 0) > 0);
    if (validItems.length === 0) return Alert.alert('Requerido', 'Agregá al menos un producto con nombre y precio.');
    if (totalAmount <= 0) return Alert.alert('Requerido', 'El monto total debe ser mayor a 0.');
    if (advance < 0) return Alert.alert('Inválido', 'El anticipo no puede ser negativo.');
    if (advance > totalAmount) return Alert.alert('Inválido', `El anticipo (${formatCurrency(advance)}) no puede ser mayor al total (${formatCurrency(totalAmount)}).`);
    if (count <= 0) return Alert.alert('Requerido', 'Ingresá la cantidad de cuotas.');
    if (count > 360) return Alert.alert('Inválido', 'La cantidad de cuotas no puede superar 360.');

    let payDay = 0;
    if (frequency === 'monthly') {
      payDay = parseInt(paymentDay);
      if (!payDay || payDay < 1 || payDay > 31) return Alert.alert('Inválido', 'El día de pago debe ser entre 1 y 31.');
    }

    for (const it of validItems) {
      const qty = parseInt(it.quantity) || 1;
      if (it.product && it.product.stock < qty) {
        const ok = await new Promise<boolean>(resolve => {
          Alert.alert(
            'Stock insuficiente',
            `${it.product!.name} tiene ${it.product!.stock} uds. ¿Registrar igual?`,
            [{ text: 'Cancelar', onPress: () => resolve(false) }, { text: 'Sí', onPress: () => resolve(true) }]
          );
        });
        if (!ok) return;
      }
    }

    const summaryName = validItems.map(it => {
      const qty = parseInt(it.quantity) || 1;
      return qty > 1 ? `${it.productName.trim()} x${qty}` : it.productName.trim();
    }).join(', ');

    setSaving(true);
    try {
      const saleItems = validItems.map(it => ({
        product_id: it.product?.id ?? null,
        product_name: it.productName.trim(),
        quantity: parseInt(it.quantity) || 1,
        unit_price: parseFloat(it.unitPrice) || 0,
      }));

      const saleId = await createSale({
        client_id: Number(clientId),
        product_name: summaryName,
        total_amount: totalAmount,
        advance_payment: advance,
        installments_count: count,
        installment_amount: installmentAmount,
        payment_day: payDay,
        installment_frequency: frequency,
        start_date: startDate,
        delivery_date: deliveryDate,
        notes: '',
      }, saleItems);

      let dates: string[];
      if (frequency === 'weekly') {
        dates = generateWeeklyInstallmentDates(startDate, count);
      } else if (frequency === 'biweekly') {
        dates = generateBiweeklyInstallmentDates(startDate, count);
      } else {
        dates = generateInstallmentDates(startDate, payDay, count);
      }

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
    } catch (e: any) {
      Alert.alert('Error al guardar', e?.message ?? 'No se pudo guardar la venta. Verificá que hayas ejecutado el SQL en Supabase.');
      setSaving(false);
    }
  };

  const freqLabel = FREQ_OPTIONS.find(f => f.key === frequency)?.sublabel ?? '';

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

        {/* Items */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>PRODUCTOS</Text>
          <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addItemText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {items.map((item, index) => (
          <View key={item.key} style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemCardTitle}>Producto {index + 1}</Text>
              <TouchableOpacity onPress={() => removeItem(item.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>

            {item.product ? (
              <View style={styles.selectedProduct}>
                <View style={styles.selectedInfo}>
                  <Ionicons name="cube" size={14} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName}>{item.product.name}</Text>
                    <Text style={styles.selectedStock}>
                      Stock: <Text style={{ color: item.product.stock > 0 ? colors.success : colors.danger, fontWeight: '700' }}>{item.product.stock} uds</Text>
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => updateItem(item.key, { product: null, productName: '', unitPrice: '' })}>
                  <Ionicons name="close-circle" size={18} color={colors.textDim} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.fromStockBtn} onPress={() => setShowProductModal(item.key)}>
                <Ionicons name="cube-outline" size={14} color={colors.primary} />
                <Text style={styles.fromStockText}>Seleccionar del stock (opcional)</Text>
              </TouchableOpacity>
            )}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nombre del producto *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="bag-outline" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.input}
                  value={item.productName}
                  onChangeText={v => updateItem(item.key, { productName: v })}
                  placeholder="Ej: Enova Tab10"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.itemRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Cantidad</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="layers-outline" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.input}
                    value={item.quantity}
                    onChangeText={v => updateItem(item.key, { quantity: v })}
                    placeholder="1"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={[styles.field, { flex: 2 }]}>
                <Text style={styles.fieldLabel}>Precio unitario *</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.prefix}>$</Text>
                  <TextInput
                    style={styles.input}
                    value={formatInputNumber(item.unitPrice)}
                    onChangeText={v => updateItem(item.key, { unitPrice: v.replace(/\D/g, '') })}
                    placeholder="0"
                    placeholderTextColor={colors.textDim}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {(parseInt(item.quantity) || 0) > 0 && (parseFloat(item.unitPrice) || 0) > 0 && (
              <Text style={styles.subtotal}>
                Subtotal: {formatCurrency((parseInt(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0))}
              </Text>
            )}
          </View>
        ))}

        {/* Amounts */}
        <Text style={[styles.sectionLabel, { marginTop: 12 }]}>MONTOS</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Anticipo</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="wallet-outline" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
            <Text style={styles.prefix}>$</Text>
            <TextInput
              style={styles.input}
              value={advancePayment}
              onChangeText={setAdvancePayment}
              placeholder="0"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
            />
          </View>
        </View>

        {totalAmount > 0 && (() => {
          const validItems = items.filter(it => it.productName.trim() && (parseFloat(it.unitPrice) || 0) > 0);
          return (
            <View style={styles.summaryBox}>
              {validItems.map((it, i) => {
                const qty = parseInt(it.quantity) || 1;
                const price = parseFloat(it.unitPrice) || 0;
                return (
                  <View key={it.key}>
                    <View style={styles.itemBreakRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemBreakName} numberOfLines={1}>{it.productName.trim()}</Text>
                        <Text style={styles.itemBreakDetail}>{qty} {qty === 1 ? 'unidad' : 'unidades'} × {formatCurrency(price)} c/u</Text>
                      </View>
                      <Text style={styles.itemBreakSubtotal}>{formatCurrency(qty * price)}</Text>
                    </View>
                    {i < validItems.length - 1 && <View style={styles.dividerLight} />}
                  </View>
                );
              })}
              <View style={styles.divider} />
              <SRow label="Total" value={formatCurrency(totalAmount)} />
              <SRow label="Anticipo" value={formatCurrency(advance)} />
              <View style={styles.divider} />
              <SRow label="Saldo a financiar" value={formatCurrency(remaining)} highlight />
            </View>
          );
        })()}

        {/* Installment plan */}
        <Text style={[styles.sectionLabel, { marginTop: 12 }]}>PLAN DE CUOTAS</Text>

        {/* Frequency selector */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Frecuencia de pago</Text>
          <View style={styles.freqRow}>
            {FREQ_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.freqBtn, frequency === opt.key && styles.freqBtnActive]}
                onPress={() => setFrequency(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.freqBtnLabel, frequency === opt.key && styles.freqBtnLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.freqBtnSub, frequency === opt.key && styles.freqBtnSubActive]}>
                  {opt.sublabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Cantidad de cuotas *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="layers-outline" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.input}
              value={installmentsCount}
              onChangeText={setInstallmentsCount}
              placeholder="Ej: 12"
              placeholderTextColor={colors.textDim}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Day of payment — only for monthly */}
        {frequency === 'monthly' && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Día de pago (1-31)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="calendar-outline" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
              <TextInput
                style={styles.input}
                value={paymentDay}
                onChangeText={setPaymentDay}
                placeholder="Ej: 10"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {installmentAmount > 0 && (
          <View style={styles.installmentPreview}>
            <View style={styles.previewHeader}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.previewTitle}>Resumen del plan</Text>
            </View>
            <Text style={styles.previewAmount}>
              {count} cuotas {freqLabel.toLowerCase()} de{' '}
              <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatCurrency(installmentAmount)}</Text>
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

        {/* Dates */}
        <Text style={[styles.sectionLabel, { marginTop: 12 }]}>FECHAS</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Fecha de inicio</Text>
          <DateInput value={startDate} onChange={setStartDate} placeholder="AAAA-MM-DD" />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Fecha de entrega (opcional)</Text>
          <DateInput value={deliveryDate} onChange={setDeliveryDate} placeholder="Opcional — AAAA-MM-DD" />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Registrar Venta'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Product picker */}
      <BottomSheet visible={showProductModal !== null} onClose={() => setShowProductModal(null)} title="Seleccionar producto">
        <FlatList
          data={products}
          keyExtractor={(item) => item.id.toString()}
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>Sin productos en stock</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.productRow} onPress={() => selectProduct(showProductModal!, item)} activeOpacity={0.7}>
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
      </BottomSheet>
    </KeyboardAvoidingView>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginLeft: 4 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  addItemText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  itemCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.primary },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  itemCardTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  fromStockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary + '15', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.primary + '33' },
  fromStockText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  selectedProduct: { backgroundColor: colors.primary + '15', borderRadius: 10, padding: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.primary + '33' },
  selectedInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedName: { fontSize: 13, fontWeight: '700', color: colors.text },
  selectedStock: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 4, marginLeft: 2 },
  inputWrapper: { backgroundColor: colors.bg, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  prefix: { color: colors.textMuted, fontSize: 14, marginRight: 2 },
  input: { flex: 1, color: colors.text, fontSize: 14 },
  itemRow: { flexDirection: 'row', gap: 8 },
  subtotal: { fontSize: 12, color: colors.primary, fontWeight: '700', textAlign: 'right', marginTop: 2 },
  summaryBox: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.primary },
  itemBreakRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  itemBreakName: { fontSize: 13, fontWeight: '700', color: colors.text },
  itemBreakDetail: { fontSize: 11, color: colors.textDim, marginTop: 1 },
  itemBreakSubtotal: { fontSize: 14, fontWeight: '800', color: colors.primary },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },
  dividerLight: { height: 1, backgroundColor: colors.border + '66', marginVertical: 2 },
  freqRow: { flexDirection: 'row', gap: 8 },
  freqBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  freqBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  freqBtnLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  freqBtnLabelActive: { color: colors.primary },
  freqBtnSub: { fontSize: 10, color: colors.textDim, marginTop: 2 },
  freqBtnSubActive: { color: colors.primary + 'AA' },
  installmentPreview: { backgroundColor: colors.primary + '15', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.primary + '44' },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  previewTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  previewAmount: { fontSize: 14, color: colors.text, marginBottom: 8 },
  datesPreview: { gap: 4 },
  dateChip: { backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  dateChipText: { fontSize: 12, color: colors.textMuted },
  moreDates: { fontSize: 12, color: colors.textDim, fontStyle: 'italic', marginTop: 2 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  productRowInfo: { flex: 1 },
  productRowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  productRowPrice: { fontSize: 13, color: colors.primary, fontWeight: '700', marginTop: 2 },
  stockPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  stockPillText: { fontSize: 12, fontWeight: '700' },
});
