import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '../../lib/database';
import { colors } from '../../lib/colors';

export default function NewClientScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zone, setZone] = useState('');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Requerido', 'El nombre del cliente es obligatorio.');
    setSaving(true);
    try {
      await createClient({ name: name.trim(), dni, phone, address, zone, reference });
      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el cliente.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>INFORMACIÓN PERSONAL</Text>
        <Field icon="person" label="Nombre y Apellido *" value={name} onChangeText={setName} placeholder="Ej: Sandra Noemi Alegre" autoCapitalize="words" />
        <Field icon="card" label="DNI" value={dni} onChangeText={setDni} placeholder="Ej: 33953133" keyboardType="numeric" />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>CONTACTO Y UBICACIÓN</Text>
        <Field icon="call" label="Celular" value={phone} onChangeText={setPhone} placeholder="Ej: 1123392390" keyboardType="phone-pad" />
        <Field icon="home" label="Domicilio" value={address} onChangeText={setAddress} placeholder="Ej: Gral Rodriguez 123" autoCapitalize="words" />
        <Field icon="location" label="Zona / Barrio" value={zone} onChangeText={setZone} placeholder="Ej: Centro, Villa del Parque..." autoCapitalize="words" />
        <Field icon="people" label="Referencia / Cómo nos conoció" value={reference} onChangeText={setReference} placeholder="Ej: Mujer de Mario" autoCapitalize="words" />

        <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle" size={20} color={colors.white} />
          <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : 'Guardar Cliente'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={16} color={colors.textDim} style={{ marginRight: 8 }} />
        <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.textDim} keyboardType={keyboardType ?? 'default'} autoCapitalize={autoCapitalize ?? 'none'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  inputWrapper: { backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  saveButton: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
