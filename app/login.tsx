import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/colors';

// ─── Rate limiter: max 5 intentos por 10 minutos por dispositivo ─────────────
const loginAttempts: { count: number; firstAt: number } = { count: 0, firstAt: 0 };
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutos

function checkRateLimit(): { blocked: boolean; waitSecs: number } {
  const now = Date.now();
  if (now - loginAttempts.firstAt > WINDOW_MS) {
    loginAttempts.count = 0;
    loginAttempts.firstAt = now;
  }
  loginAttempts.count++;
  if (loginAttempts.count > MAX_ATTEMPTS) {
    const waitSecs = Math.ceil((WINDOW_MS - (now - loginAttempts.firstAt)) / 1000);
    return { blocked: true, waitSecs };
  }
  return { blocked: false, waitSecs: 0 };
}

// ─── Alerta de seguridad (fire-and-forget) ────────────────────────────────────
async function reportFailedLogin(email: string) {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    await fetch(`${supabaseUrl}/functions/v1/resend-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey ?? '',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        email,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
      }),
    });
  } catch {
    // Fire-and-forget — nunca bloquea la UI
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [failCount, setFailCount] = useState(0);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return Alert.alert('Requerido', 'Ingresá email y contraseña.');
    }

    // Validación básica de formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return Alert.alert('Email inválido', 'Ingresá un email con formato válido.');
    }

    // Rate limit client-side
    const { blocked, waitSecs } = checkRateLimit();
    if (blocked) {
      const mins = Math.ceil(waitSecs / 60);
      return Alert.alert(
        '⛔ Demasiados intentos',
        `Demasiados intentos fallidos. Esperá ${mins} minuto${mins !== 1 ? 's' : ''} antes de intentar nuevamente.`
      );
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    setLoading(false);

    if (error) {
      const newCount = failCount + 1;
      setFailCount(newCount);

      // Mensaje genérico — no revela si el email existe o no
      Alert.alert(
        'Acceso denegado',
        newCount >= 3
          ? 'Credenciales incorrectas. Si olvidaste tu contraseña, contactá al administrador.'
          : 'Email o contraseña incorrectos.'
      );

      reportFailedLogin(cleanEmail);
    } else {
      setFailCount(0);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <View style={styles.logoIcon}>
            <Ionicons name="storefront" size={40} color={colors.primary} />
          </View>
          <Text style={styles.appName}>Clientes y Stock</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar sesión</Text>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color={colors.textDim} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Contraseña</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textDim} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textDim}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          {failCount >= 3 && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={14} color={colors.warning} />
              <Text style={styles.warningText}>
                {MAX_ATTEMPTS - loginAttempts.count} intento{MAX_ATTEMPTS - loginAttempts.count !== 1 ? 's' : ''} restante{MAX_ATTEMPTS - loginAttempts.count !== 1 ? 's' : ''} antes del bloqueo temporal
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.buttonText}>Ingresar</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  logoSection: { alignItems: 'center', marginBottom: 36 },
  logoIcon: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: colors.primary + '22',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  appName: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 24 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, marginLeft: 2 },
  inputWrapper: {
    backgroundColor: colors.bg, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border, gap: 10,
  },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.warning + '18', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, marginTop: 10,
    borderWidth: 1, borderColor: colors.warning + '44',
  },
  warningText: { fontSize: 11, color: colors.warning, flex: 1 },
  button: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
