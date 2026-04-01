import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../lib/colors';

const TABS = [
  { label: 'Inicio',   icon: 'home',     path: '/' },
  { label: 'Clientes', icon: 'people',   path: '/clients' },
  { label: 'Cobros',   icon: 'cash',     path: '/cobros' },
  { label: 'Stock',    icon: 'cube',     path: '/stock' },
  { label: 'Zonas',    icon: 'navigate', path: '/zones' },
  { label: 'Más',      icon: 'ellipsis-horizontal-circle', path: '/settings' },
] as const;

function getActiveTab(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  if (pathname.startsWith('/clients') || pathname.startsWith('/client') || pathname.startsWith('/sale')) return '/clients';
  if (pathname.startsWith('/cobros')) return '/cobros';
  if (pathname.startsWith('/stock') || pathname.startsWith('/product')) return '/stock';
  if (pathname.startsWith('/zones')) return '/zones';
  if (pathname.startsWith('/settings')) return '/settings';
  return '/';
}

export function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = getActiveTab(pathname);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.path;
        return (
          <TouchableOpacity
            key={tab.path}
            onPress={() => router.navigate(tab.path as any)}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? tab.icon : (`${tab.icon}-outline` as any)}
              size={19}
              color={isActive ? colors.primary : colors.textDim}
            />
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, paddingBottom: 2 },
  label: { fontSize: 9, fontWeight: '600', color: colors.textDim },
  activeLabel: { color: colors.primary },
});
