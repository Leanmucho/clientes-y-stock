import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClients } from '../../lib/database';
import { Client } from '../../types';
import { colors } from '../../lib/colors';
import { Loading } from '../../components/Loading';

export default function ClientsScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    getClients().then((data) => { if (active) { setClients(data); setLoading(false); } });
    setLoading(false);
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const data = await getClients();
    setClients(data);
    setRefreshing(false);
  }, []);

  if (loading) return <Loading />;

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dni.includes(search) || c.phone.includes(search)
  );

  return (
    <>
    <Stack.Screen options={{
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/zones')} style={{ marginRight: 8 }}>
          <Ionicons name="navigate-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      ),
    }} />
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, DNI o celular..."
          placeholderTextColor={colors.textDim}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin clientes'}</Text>
            <Text style={styles.emptySubtitle}>{search ? 'Probá con otro término' : 'Tocá + para agregar tu primer cliente'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.clientCard} onPress={() => router.push(`/client/${item.id}`)} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{item.name}</Text>
              <View style={styles.clientMeta}>
                {item.dni ? <View style={styles.metaItem}><Ionicons name="card-outline" size={12} color={colors.textDim} /><Text style={styles.metaText}>{item.dni}</Text></View> : null}
                {item.phone ? <View style={styles.metaItem}><Ionicons name="call-outline" size={12} color={colors.textDim} /><Text style={styles.metaText}>{item.phone}</Text></View> : null}
              </View>
              {item.address ? <Text style={styles.clientAddress} numberOfLines={1}>{item.address}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/client/new')} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, margin: 12, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  list: { paddingHorizontal: 12, paddingBottom: 90 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim, textAlign: 'center' },
  clientCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '33', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  clientMeta: { flexDirection: 'row', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: colors.textDim },
  clientAddress: { fontSize: 12, color: colors.textDim, marginTop: 3 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
});
