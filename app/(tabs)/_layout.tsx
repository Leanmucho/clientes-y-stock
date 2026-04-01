import { Tabs } from 'expo-router';
import { colors } from '../../lib/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: 'none' },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index"    options={{ headerTitle: 'Panel Principal' }} />
      <Tabs.Screen name="clients"  options={{ headerTitle: 'Clientes' }} />
      <Tabs.Screen name="cobros"   options={{ headerTitle: 'Cobros' }} />
      <Tabs.Screen name="gastos"   options={{ headerTitle: 'Gastos' }} />
      <Tabs.Screen name="stock"    options={{ headerTitle: 'Stock' }} />
      <Tabs.Screen name="settings" options={{ headerTitle: 'Configuración' }} />
    </Tabs>
  );
}
