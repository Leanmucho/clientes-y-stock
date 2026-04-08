import { useEffect, useState, useRef } from 'react';
import { View, PanResponder } from 'react-native';
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { initDatabase } from '../lib/database';
import { colors } from '../lib/colors';
import { BottomTabBar } from '../components/BottomTabBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { scheduleDailyDueNotification } from '../services/notifications';

const SWIPE_TABS = ['/', '/clients', '/cobros', '/gastos', '/stock', '/settings'];

function getActiveTabPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/clients') || pathname.startsWith('/client') || pathname.startsWith('/sale')) return '/clients';
  if (pathname.startsWith('/cobros')) return '/cobros';
  if (pathname.startsWith('/gastos') || pathname.startsWith('/expense')) return '/gastos';
  if (pathname.startsWith('/stock') || pathname.startsWith('/product')) return '/stock';
  if (pathname.startsWith('/settings')) return '/settings';
  return '/';
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const showTabBarRef = useRef(false);
  const currentTabIdxRef = useRef(0);
  const navigateRef = useRef<(path: string) => void>(() => {});

  useEffect(() => {
    navigateRef.current = (path: string) => router.navigate(path as Parameters<typeof router.navigate>[0]);
  }, [router]);

  useEffect(() => {
    const activeTab = getActiveTabPath(pathname);
    const idx = SWIPE_TABS.indexOf(activeTab);
    currentTabIdxRef.current = idx !== -1 ? idx : 0;
  }, [pathname]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        showTabBarRef.current &&
        Math.abs(g.dx) > 20 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => true,
      onPanResponderRelease: (_, g) => {
        const idx = currentTabIdxRef.current;
        if (g.dx < -60 && idx < SWIPE_TABS.length - 1) {
          navigateRef.current(SWIPE_TABS[idx + 1]);
        } else if (g.dx > 60 && idx > 0) {
          navigateRef.current(SWIPE_TABS[idx - 1]);
        }
      },
    })
  ).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      if (s) {
        initDatabase();
        scheduleDailyDueNotification().catch(() => {});
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        initDatabase();
        scheduleDailyDueNotification().catch(() => {});
      }
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
  showTabBarRef.current = showTabBar;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: colors.bg }} {...panResponder.panHandlers}>
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
              <Stack.Screen name="expense/new" options={{ title: 'Nuevo Gasto', presentation: 'modal' }} />
              <Stack.Screen name="expense/[id]" options={{ title: 'Gasto' }} />
              <Stack.Screen name="supplier/new" options={{ title: 'Nuevo Proveedor', presentation: 'modal' }} />
              <Stack.Screen name="supplier/[id]" options={{ title: 'Proveedor' }} />
              <Stack.Screen name="proveedores" options={{ title: 'Proveedores' }} />
              <Stack.Screen name="equipo" options={{ title: 'Equipo' }} />
              <Stack.Screen name="reportes" options={{ title: 'Reportes y Análisis' }} />
            </Stack>
          </View>
          {showTabBar && <BottomTabBar />}
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
