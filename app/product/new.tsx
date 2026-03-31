import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createProduct } from '../../lib/database';
import { colors } from '../../lib/colors';

export default function NewProductScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Requerido', 'El nombre del producto es obligatorio.');
    setSaving(true);
    try {
      await createProduct({
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price) || 0,
        stock: parseInt(stock) || 0,
        min_stock: parseInt(minStock) || 5,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el producto.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>INFORMACIÓN DEL PRODUCTO</Text>
        <Field icon="cube" label="Nombre *" value={name} onChangeText={setName} placeholder="Ej: Enova Tab10 4G" autoCapitalize="words" />
        <Field icon="document-text" label="Descripción" value={description} onChangeText={setDescription} placeholder="Opcional" autoCapitalize="sentences" />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>PRECIO Y STOCK</Text>
        <Field icon="cash" label="Precio de venta" value={price} onChangeText={setPrice} placeholder="0" keyboardType="numeric" prefix="$" />
        <Field icon="layers" label="Stock inicial (unidades)" value={stock} onChangeText={setStock} placeholder="0" keyboardType="numeric" />
        <Field icon="alert-circle" label="Stock mínimo (alerta)" value={minStock} onChangeText={setMinStock} placeholder="5" keyboardType="numeric" />

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar Producto'}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  inputWrapper: {
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
});
