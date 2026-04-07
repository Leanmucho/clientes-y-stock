import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, RefreshControl, Image, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getProduct, updateProduct, deleteProduct, getCategories, createCategory } from '../../lib/database';
import { uploadProductImage } from '../../lib/storage';
import { Product, Category } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency, formatInputNumber } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { BottomSheet } from '../../components/BottomSheet';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [minStock, setMinStock] = useState('');
  const [stockDelta, setStockDelta] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  const load = useCallback(async () => {
    const [p, cats] = await Promise.all([getProduct(Number(id)), getCategories()]);
    setCategories(cats);
    setProduct(p);
    if (p) {
      setName(p.name);
      setDescription(p.description);
      setPrice(p.price.toString());
      setMinStock(p.min_stock.toString());
      setImageUri(null);
      setSelectedCategory(cats.find(c => c.id === p.category_id) ?? null);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getProduct(Number(id)), getCategories()]).then(([p, cats]) => {
      if (!active) return;
      setCategories(cats);
      setProduct(p);
      if (p) {
        setName(p.name); setDescription(p.description);
        setPrice(p.price.toString()); setMinStock(p.min_stock.toString());
        setImageUri(null);
        if (p.category_id) {
          setSelectedCategory(cats.find(c => c.id === p.category_id) ?? null);
        } else {
          setSelectedCategory(null);
        }
      }
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permiso requerido', 'Se necesita acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Requerido', 'El nombre es obligatorio.');
    setSaving(true);
    try {
      let image_url = product?.image_url ?? '';
      if (imageUri) {
        image_url = await uploadProductImage(imageUri);
      }
      await updateProduct(Number(id), {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        min_stock: parseInt(minStock) || 5,
        image_url,
        category_id: selectedCategory?.id ?? null,
      });
      await load();
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async (delta: number) => {
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);
    try {
      await updateProduct(Number(id), { stock: newStock });
      await load();
      setStockDelta('');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo ajustar el stock.');
    }
  };

  const handleManualStock = async () => {
    const delta = parseInt(stockDelta);
    if (isNaN(delta)) return Alert.alert('Inválido', 'Ingresá un número.');
    await handleAdjustStock(delta);
  };

  const handleDelete = () => setConfirmDelete(true);

  const confirmDoDelete = async () => {
    setDeleting(true);
    try {
      await deleteProduct(Number(id));
      setConfirmDelete(false);
      router.replace('/stock');
    } catch (e: any) {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
    }
  };

  if (loading) return <Loading />;
  if (!product) return <View style={styles.center}><Text style={{ color: colors.textMuted }}>Producto no encontrado</Text></View>;

  const isLow = product.stock <= product.min_stock;
  const isEmpty = product.stock === 0;
  const displayImage = imageUri ?? (product.image_url || null);

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

          {/* Product image */}
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={editing ? pickImage : undefined}
            activeOpacity={editing ? 0.7 : 1}
          >
            {displayImage ? (
              <Image source={{ uri: displayImage }} style={styles.productImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="cube-outline" size={40} color={colors.textDim} />
              </View>
            )}
            {editing && (
              <View style={styles.imageEditBadge}>
                <Ionicons name="camera" size={16} color={colors.white} />
                <Text style={styles.imageEditText}>Cambiar foto</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Stock card */}
          <View style={[styles.stockCard, isEmpty && { borderColor: colors.danger }, isLow && !isEmpty && { borderColor: colors.warning }]}>
            <Text style={[styles.stockNum, { color: isEmpty ? colors.danger : isLow ? colors.warning : colors.success }]}>
              {product.stock}
            </Text>
            <Text style={styles.stockLabel}>unidades en stock</Text>
            <Text style={styles.priceLabel}>{formatCurrency(product.price)} por unidad</Text>
            {isLow && (
              <View style={[styles.alertBadge, { backgroundColor: isEmpty ? colors.danger : colors.warning }]}>
                <Ionicons name="warning" size={12} color={colors.white} />
                <Text style={styles.alertText}>{isEmpty ? 'Sin stock' : 'Stock bajo'}</Text>
              </View>
            )}
          </View>

          {/* Adjust stock */}
          {!editing && (
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
          )}

          {/* Edit form */}
          {editing && (
            <View style={styles.editCard}>
              <Text style={styles.editTitle}>Editar producto</Text>
              <EditField label="Nombre" value={name} onChangeText={setName} autoCapitalize="words" />
              <EditField label="Descripción" value={description} onChangeText={setDescription} autoCapitalize="sentences" />
              <EditField
                label="Precio"
                value={formatInputNumber(price)}
                onChangeText={(v: string) => setPrice(v.replace(/\D/g, ''))}
                keyboardType="numeric"
                prefix="$"
              />
              <EditField label="Stock mínimo (alerta)" value={minStock} onChangeText={setMinStock} keyboardType="numeric" />

              {/* Category */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Categoría</Text>
                <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowCatModal(true)} activeOpacity={0.7}>
                  <Ionicons name="pricetag-outline" size={14} color={colors.textDim} style={{ marginRight: 8 }} />
                  <Text style={[styles.input, { color: selectedCategory ? colors.text : colors.textDim }]}>
                    {selectedCategory ? selectedCategory.name : 'Sin categoría'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.saveButtonText}>Guardar cambios</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Info */}
          {!editing && (
            <View style={styles.infoCard}>
              {product.description ? <InfoRow label="Descripción" value={product.description} /> : null}
              <InfoRow label="Precio" value={formatCurrency(product.price)} />
              <InfoRow label="Stock mínimo" value={`${product.min_stock} unidades`} />
              {product.category_name && <InfoRow label="Categoría" value={product.category_name} />}
            </View>
          )}

          {/* Delete button */}
          {!editing && (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Eliminar producto</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category picker */}
      <BottomSheet visible={showCatModal} onClose={() => setShowCatModal(false)} title="Categoría">
        <View style={styles.sheetContent}>
          <View style={styles.newCatRow}>
            <TextInput
              style={styles.newCatInput}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="Nueva categoría..."
              placeholderTextColor={colors.textDim}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.newCatBtn, (!newCatName.trim() || creatingCat) && { opacity: 0.5 }]}
              onPress={async () => {
                if (!newCatName.trim()) return;
                setCreatingCat(true);
                try {
                  const created = await createCategory(newCatName.trim());
                  setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
                  setSelectedCategory(created);
                  setNewCatName('');
                  setShowCatModal(false);
                } catch (e: any) {
                  Alert.alert('Error', e?.message ?? 'No se pudo crear la categoría.');
                } finally {
                  setCreatingCat(false);
                }
              }}
              disabled={!newCatName.trim() || creatingCat}
            >
              {creatingCat
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="add" size={20} color={colors.white} />
              }
            </TouchableOpacity>
          </View>
          <FlatList
            data={categories}
            keyExtractor={c => c.id.toString()}
            style={{ maxHeight: 320 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <TouchableOpacity
                style={[styles.catOption, !selectedCategory && styles.catOptionActive]}
                onPress={() => { setSelectedCategory(null); setShowCatModal(false); }}
              >
                <Ionicons name="close-circle-outline" size={16} color={!selectedCategory ? colors.primary : colors.textDim} />
                <Text style={[styles.catOptionText, !selectedCategory && { color: colors.primary }]}>Sin categoría</Text>
              </TouchableOpacity>
            }
            ListEmptyComponent={<Text style={{ color: colors.textDim, textAlign: 'center', padding: 16 }}>Escribí un nombre para crear una categoría.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.catOption, selectedCategory?.id === item.id && styles.catOptionActive]}
                onPress={() => { setSelectedCategory(item); setShowCatModal(false); }}
              >
                <Ionicons
                  name={selectedCategory?.id === item.id ? 'checkmark-circle' : 'pricetag-outline'}
                  size={16}
                  color={selectedCategory?.id === item.id ? colors.primary : colors.textDim}
                />
                <Text style={[styles.catOptionText, selectedCategory?.id === item.id && { color: colors.primary }]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </BottomSheet>

      {/* Confirm delete modal */}
      <Modal visible={confirmDelete} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="trash" size={24} color={colors.danger} />
              </View>
              <Text style={styles.modalTitle}>Eliminar producto</Text>
              <Text style={styles.modalMsg}>
                ¿Eliminar <Text style={{ fontWeight: '700', color: colors.text }}>{product.name}</Text>?{'\n'}Esta acción no se puede deshacer.
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setConfirmDelete(false)} disabled={deleting}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, deleting && { opacity: 0.6 }]}
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
  imageContainer: { alignItems: 'center', marginBottom: 16 },
  productImage: { width: 140, height: 140, borderRadius: 20, backgroundColor: colors.surface },
  imagePlaceholder: {
    width: 140, height: 140, borderRadius: 20,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.border,
  },
  imageEditBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginTop: 8,
  },
  imageEditText: { color: colors.white, fontWeight: '600', fontSize: 13 },
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
  adjustBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  adjustInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 10, padding: 10,
    color: colors.text, fontSize: 15, textAlign: 'center', borderWidth: 1, borderColor: colors.border,
  },
  applyBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: 'center' },
  applyBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  editCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12 },
  editTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 5, marginLeft: 2 },
  inputWrapper: {
    backgroundColor: colors.bg, borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
  },
  prefix: { color: colors.textMuted, marginRight: 4 },
  input: { flex: 1, color: colors.text, fontSize: 14 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  infoCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 13, color: colors.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: colors.text },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, padding: 14, borderRadius: 12,
    backgroundColor: colors.danger + '15', borderWidth: 1, borderColor: colors.danger + '33',
  },
  deleteBtnText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00000077', padding: 24 },
  modalBox: { backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '100%' },
  modalIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.danger + '22', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 6, textAlign: 'center' },
  modalMsg: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 8 },
  newCatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  newCatInput: { flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  newCatBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  catOptionActive: { backgroundColor: colors.primary + '11', borderRadius: 8, paddingHorizontal: 8 },
  catOptionText: { fontSize: 15, fontWeight: '600', color: colors.text },
  modalCancel: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: colors.textMuted, fontWeight: '700' },
  modalConfirm: { flex: 1, backgroundColor: colors.danger, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  modalConfirmText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
