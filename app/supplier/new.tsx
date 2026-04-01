import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createSupplier } from '../../lib/database';
import { colors } from '../../lib/colors';

export default function NewSupplierScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Falta información', 'Ingresá el nombre del proveedor.');
    setSaving(true);
    try {
      await createSupplier({
        name: name.trim(),
        contact_name: contactName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        category: category.trim(),
        notes: notes.trim(),
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
      <Stack.Screen options={{ title: 'Nuevo Proveedor', presentation: 'modal' }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>

          <Field icon="business-outline" label="Nombre *" value={name} onChangeText={setName} placeholder="Ej: Distribuidora García" autoCapitalize="words" />
          <Field icon="person-outline" label="Contacto" value={contactName} onChangeText={setContactName} placeholder="Nombre del contacto" autoCapitalize="words" />
          <Field icon="call-outline" label="Teléfono" value={phone} onChangeText={setPhone} placeholder="+54 9 11 ..." keyboardType="phone-pad" />
          <Field icon="mail-outline" label="Email" value={email} onChangeText={setEmail} placeholder="proveedor@mail.com" keyboardType="email-address" autoCapitalize="none" />
          <Field icon="location-outline" label="Dirección" value={address} onChangeText={setAddress} placeholder="Calle, número, ciudad" autoCapitalize="words" />
          <Field icon="pricetag-outline" label="Rubro / Categoría" value={category} onChangeText={setCategory} placeholder="Ej: Electrodomésticos, Ropa, Alimentos" autoCapitalize="sentences" />

          <Text style={styles.label}>Notas (opcional)</Text>
          <View style={[styles.inputBox, { minHeight: 80, alignItems: 'flex-start', paddingTop: 10 }]}>
            <TextInput
              style={[styles.input, { textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Condiciones de pago, plazos de entrega, etc."
              placeholderTextColor={colors.textDim}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.white} size="small" />
              : <><Ionicons name="checkmark-circle" size={20} color={colors.white} /><Text style={styles.saveBtnText}>Guardar proveedor</Text></>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Field({ icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize }: any) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Ionicons name={icon} size={16} color={colors.textDim} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginTop: 16, letterSpacing: 0.5 },
  inputBox: { backgroundColor: colors.surface, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border, gap: 8 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
