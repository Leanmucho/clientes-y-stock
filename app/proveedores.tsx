import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSuppliers } from '../lib/database';
import { colors } from '../lib/colors';
import { Loading } from '../components/Loading';
import { Supplier } from '../types';

export default function ProveedoresScreen() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    getSuppliers().then(data => {
      if (!active) return;
      setSuppliers(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await getSuppliers();
    setSuppliers(data);
    setRefreshing(false);
  }, []);

  const filtered = search.trim()
    ? suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.category?.toLowerCase().includes(search.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(search.toLowerCase())
      )
    : suppliers;

  if (loading) return <Loading />;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Proveedores',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/supplier/new' as any)} style={{ padding: 6 }}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textDim} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar proveedor..."
              placeholderTextColor={colors.textDim}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="business-outline" size={44} color={colors.textDim} />
              <Text style={styles.emptyTitle}>{suppliers.length === 0 ? 'Sin proveedores' : 'Sin resultados'}</Text>
              <Text style={styles.emptySubtitle}>
                {suppliers.length === 0
                  ? 'Tocá + para agregar tu primer proveedor'
                  : 'Probá con otro término de búsqueda'
                }
              </Text>
            </View>
          ) : (
            filtered.map(supplier => (
              <TouchableOpacity
                key={supplier.id}
                style={styles.supplierCard}
                onPress={() => router.push(`/supplier/${supplier.id}` as any)}
                activeOpacity={0.75}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{supplier.name[0].toUpperCase()}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{supplier.name}</Text>
                  {supplier.category ? <Text style={styles.category}>{supplier.category}</Text> : null}
                  <View style={styles.metaRow}>
                    {supplier.phone ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="call-outline" size={11} color={colors.textDim} />
                        <Text style={styles.metaText}>{supplier.phone}</Text>
                      </View>
                    ) : null}
                    {supplier.contact_name ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={11} color={colors.textDim} />
                        <Text style={styles.metaText}>{supplier.contact_name}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/supplier/new' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBox: { backgroundColor: colors.bg, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  content: { padding: 16, paddingBottom: 100 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  emptySubtitle: { color: colors.textDim, fontSize: 13, textAlign: 'center' },
  supplierCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  category: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 1 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textDim },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});
