import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { initDatabase } from '../lib/database';
import { colors } from '../lib/colors';
import { BottomTabBar } from '../components/BottomTabBar';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) initDatabase();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) initDatabase();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    const onLoginScreen = segments[0] === 'login';
    if (!session && !onLoginScreen) {
      router.replace('/login');
    } else if (session && onLoginScreen) {
      router.replace('/');
    }
  }, [session, loading, segments]);

  if (loading) return null;

  const showTabBar = !!session && segments[0] !== 'login';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700', fontSize: 17 },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="client/new" options={{ title: 'Nuevo Cliente', presentation: 'modal' }} />
          <Stack.Screen name="client/[id]" options={{ title: 'Cliente' }} />
          <Stack.Screen name="sale/new" options={{ title: 'Nueva Venta', presentation: 'modal' }} />
          <Stack.Screen name="sale/[id]" options={{ title: 'Detalle de Venta' }} />
          <Stack.Screen name="product/new" options={{ title: 'Nuevo Producto', presentation: 'modal' }} />
          <Stack.Screen name="product/[id]" options={{ title: 'Producto' }} />
          <Stack.Screen name="zones" options={{ title: 'Zonas y Rutas' }} />
        </Stack>
      </View>
      {showTabBar && <BottomTabBar />}
    </View>
  );
}
