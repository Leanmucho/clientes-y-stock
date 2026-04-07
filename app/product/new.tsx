import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createProduct, getCategories, createCategory } from '../../lib/database';
import { Category } from '../../types';
import { uploadProductImage } from '../../lib/storage';
import { colors } from '../../lib/colors';
import { formatInputNumber } from '../../lib/utils';
import { BottomSheet } from '../../components/BottomSheet';

export default function NewProductScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  useEffect(() => { getCategories().then(setCategories); }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permiso requerido', 'Se necesita acceso a la galería de fotos.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleCreateCategory = async () => {
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
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Requerido', 'El nombre del producto es obligatorio.');
    setSaving(true);
    try {
      let image_url = '';
      if (imageUri) {
        image_url = await uploadProductImage(imageUri);
      }
      await createProduct({
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        stock: parseInt(stock) || 0,
        min_stock: parseInt(minStock) || 5,
        image_url,
        category_id: selectedCategory?.id ?? null,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo guardar el producto.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Photo picker */}
        <Text style={styles.sectionLabel}>FOTO DEL PRODUCTO</Text>
        <TouchableOpacity style={styles.photoPicker} onPress={pickImage} activeOpacity={0.7}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={styles.photoPreview} />
              <View style={styles.photoEditOverlay}>
                <Ionicons name="camera" size={20} color={colors.white} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={32} color={colors.textDim} />
              </View>
              <Text style={styles.photoHint}>Toca para agregar foto</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>INFORMACIÓN DEL PRODUCTO</Text>
        <Field icon="cube" label="Nombre *" value={name} onChangeText={setName} placeholder="Ej: Enova Tab10 4G" autoCapitalize="words" />
        <Field icon="document-text" label="Descripción" value={description} onChangeText={setDescription} placeholder="Opcional" autoCapitalize="sentences" />

        {/* Category selector */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Categoría</Text>
          <TouchableOpacity style={styles.categorySelector} onPress={() => setShowCatModal(true)} activeOpacity={0.7}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textDim} style={{ marginRight: 8 }} />
            {selectedCategory ? (
              <Text style={[styles.input, { color: colors.text }]}>{selectedCategory.name}</Text>
            ) : (
              <Text style={[styles.input, { color: colors.textDim }]}>Sin categoría</Text>
            )}
            <Ionicons name="chevron-down" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PRECIO Y STOCK</Text>
        <Field
          icon="cash"
          label="Precio de venta"
          value={formatInputNumber(price)}
          onChangeText={(v: string) => setPrice(v.replace(/\D/g, ''))}
          placeholder="0"
          keyboardType="numeric"
          prefix="$"
        />
        <Field icon="layers" label="Stock inicial (unidades)" value={stock} onChangeText={setStock} placeholder="0" keyboardType="numeric" />
        <Field icon="alert-circle" label="Stock mínimo (alerta)" value={minStock} onChangeText={setMinStock} placeholder="5" keyboardType="numeric" />

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={colors.white} size="small" />
            : <>
                <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                <Text style={styles.saveButtonText}>Guardar Producto</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* Category picker */}
      <BottomSheet visible={showCatModal} onClose={() => setShowCatModal(false)} title="Seleccionar categoría">
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
              onPress={handleCreateCategory}
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
            ListEmptyComponent={
              <Text style={styles.noCats}>Escribí un nombre arriba para crear tu primera categoría.</Text>
            }
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
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  photoPicker: { alignItems: 'center', marginBottom: 8 },
  photoPreview: { width: 120, height: 120, borderRadius: 16, backgroundColor: colors.surface },
  photoEditOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  photoPlaceholder: {
    width: 120, height: 120, borderRadius: 16,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
  },
  photoHint: { fontSize: 12, color: colors.textDim, marginTop: 8 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  inputWrapper: {
    backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  categorySelector: {
    backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  prefix: { color: colors.textMuted, fontSize: 15, marginRight: 4 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  saveButton: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24,
  },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 8 },
  newCatRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  newCatInput: {
    flex: 1, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, color: colors.text, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  newCatBtn: {
    width: 42, height: 42, borderRadius: 10, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  noCats: { color: colors.textDim, textAlign: 'center', padding: 16, fontSize: 13 },
  catOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  catOptionActive: { backgroundColor: colors.primary + '11', borderRadius: 8, paddingHorizontal: 8 },
  catOptionText: { fontSize: 15, fontWeight: '600', color: colors.text },
});
