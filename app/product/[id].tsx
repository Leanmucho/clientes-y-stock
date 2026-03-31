import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { useFocusEffect, useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProduct, updateProduct } from '../../lib/database';
import { Product } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/utils';
import { Loading } from '../../components/Loading';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);

  // edit fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [stockDelta, setStockDelta] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const p = await getProduct(Number(id));
    setProduct(p);
    if (p) { setName(p.name); setDescription(p.description); setPrice(p.price.toString()); setMinStock(p.min_stock.toString()); }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    getProduct(Number(id)).then((p) => {
      if (!active) return;
      setProduct(p);
      if (p) { setName(p.name); setDescription(p.description); setPrice(p.price.toString()); setMinStock(p.min_stock.toString()); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Requerido', 'El nombre es obligatorio.');
    setSaving(true);
    try {
      await updateProduct(Number(id), {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        min_stock: parseInt(minStock) || 5,
      });
      await load();
      setEditing(false);
    } catch {
      Alert.alert('Error', 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (delta: number) => {
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);
    await updateProduct(Number(id), { stock: newStock });
    await load();
    setStockDelta('');
  };

  const handleManualStock = async () => {
    const delta = parseInt(stockDelta);
    if (isNaN(delta)) return Alert.alert('Inválido', 'Ingresá un número.');
    await handleAdjustStock(delta);
  };

  if (loading) return <Loading />;
  if (!product) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Producto no encontrado</Text></View>;

  const isLow = product.stock <= product.min_stock;
  const isEmpty = product.stock === 0;

  return (
    <>
      <Stack.Screen options={{
        title: product.name,
        headerRight: () => (
          <TouchableOpacity onPress={() => setEditing(!editing)} style={{ marginRight: 4 }}>
            <Ionicons name={editing ? 'close' : 'pencil'} size={20} color={colors.primary} />
          </TouchableOpacity>
        ),
      }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

          {/* Stock card */}
          <View style={[styles.stockCard, isEmpty && { borderColor: colors.danger }, isLow && !isEmpty && { borderColor: colors.warning }]}>
            <Text style={[styles.stockNum, { color: isEmpty ? colors.danger : isLow ? colors.warning : colors.success }]}>
              {product.stock}
            </Text>
            <Text style={styles.stockLabel}>unidades en stock</Text>
            <Text style={styles.priceLabel}>{formatCurrency(product.price)} por unidad</Text>
            {isLow && <View style={[styles.alertBadge, { backgroundColor: isEmpty ? colors.danger : colors.warning }]}>
              <Ionicons name="warning" size={12} color={colors.white} />
              <Text style={styles.alertText}>{isEmpty ? 'Sin stock' : 'Stock bajo'}</Text>
            </View>}
          </View>

          {/* Adjust stock */}
          <View style={styles.adjustCard}>
            <Text style={styles.adjustTitle}>Ajustar stock</Text>
            <View style={styles.adjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => handleAdjustStock(-1)}>
                <Ionicons name="remove" size={22} color={colors.danger} />
              </TouchableOpacity>
              <TextInput
                style={styles.adjustInput}
                value={stockDelta}
                onChangeText={setStockDelta}
                placeholder="+/- cantidad"
                placeholderTextColor={colors.textDim}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.adjustBtn} onPress={() => handleAdjustStock(1)}>
                <Ionicons name="add" size={22} color={colors.success} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={handleManualStock}>
              <Text style={styles.applyBtnText}>Aplicar ajuste</Text>
            </TouchableOpacity>
          </View>

          {/* Edit form */}
          {editing && (
            <View style={styles.editCard}>
              <Text style={styles.editTitle}>Editar producto</Text>
              <EditField label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" />
              <EditField label="Descripción" value={description} onChangeText={setDescription} autoCapitalize="sentences" />
              <EditField label="Precio" value={price} onChangeText={setPrice} keyboardType="numeric" prefix="$" />
              <EditField label="Stock mínimo (alerta)" value={minStock} onChangeText={setMinStock} keyboardType="numeric" />
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar cambios'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info */}
          {!editing && (
            <View style={styles.infoCard}>
              {product.description ? <InfoRow label="Descripción" value={product.description} /> : null}
              <InfoRow label="Precio" value={formatCurrency(product.price)} />
              <InfoRow label="Stock mínimo" value={`${product.min_stock} unidades`} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EditField({ label, value, onChangeText, keyboardType, autoCapitalize, prefix }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput style={styles.input} value={value} onChangeText={onChangeText}
          keyboardType={keyboardType ?? 'default'} autoCapitalize={autoCapitalize ?? 'none'}
          placeholderTextColor={colors.textDim} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  stockCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: colors.border,
  },
  stockNum: { fontSize: 56, fontWeight: '900' },
  stockLabel: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  priceLabel: { fontSize: 15, color: colors.primary, fontWeight: '700', marginTop: 6 },
  alertBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10,
  },
  alertText: { fontSize: 12, fontWeight: '700', color: colors.white },
  adjustCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  adjustTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  adjustBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg,
    justifyContent: 'center', alignItems: 'center',
  },
  adjustInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 10,
    padding: 10, color: colors.text, fontSize: 15, textAlign: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  applyBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  applyBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  editCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  editTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 5, marginLeft: 2 },
  inputWrapper: {
    backgroundColor: colors.bg, borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  prefix: { color: colors.textMuted, marginRight: 4 },
  input: { flex: 1, color: colors.text, fontSize: 14 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  infoCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text },
});
