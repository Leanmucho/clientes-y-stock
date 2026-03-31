import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { initDatabase } from '../lib/database';
import { colors } from '../lib/colors';

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="client/new" options={{ title: 'Nuevo Cliente', presentation: 'modal' }} />
        <Stack.Screen name="client/[id]" options={{ title: 'Cliente' }} />
        <Stack.Screen name="sale/new" options={{ title: 'Nueva Venta', presentation: 'modal' }} />
        <Stack.Screen name="sale/[id]" options={{ title: 'Detalle de Venta' }} />
        <Stack.Screen name="product/new" options={{ title: 'Nuevo Producto', presentation: 'modal' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Producto' }} />
      </Stack>
    </>
  );
}
