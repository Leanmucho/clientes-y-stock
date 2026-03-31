import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProducts } from '../../lib/database';
import { Product } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/utils';
import { Loading } from '../../components/Loading';

export default function StockScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getProducts();
    setProducts(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    getProducts().then((data) => { if (active) { setProducts(data); setLoading(false); } });
    setLoading(false);
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textDim} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto..."
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
            <Ionicons name="cube-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin productos'}</Text>
            <Text style={styles.emptySubtitle}>Toca + para agregar tu primer producto</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLow = item.stock <= item.min_stock;
          const isEmpty = item.stock === 0;
          return (
            <TouchableOpacity
              style={[styles.card, isEmpty && styles.cardEmpty]}
              onPress={() => router.push(`/product/${item.id}`)}
              activeOpacity={0.7}
            >
              {item.image_url ? (
                <View style={styles.thumbContainer}>
                  <Image source={{ uri: item.image_url }} style={styles.thumb} />
                  <View style={[styles.thumbBadge, { backgroundColor: isEmpty ? colors.danger : isLow ? colors.warning : colors.success }]}>
                    <Text style={styles.thumbBadgeText}>{item.stock}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.stockBadge, { backgroundColor: isEmpty ? colors.danger + '22' : isLow ? colors.warning + '22' : colors.success + '22' }]}>
                  <Text style={[styles.stockNum, { color: isEmpty ? colors.danger : isLow ? colors.warning : colors.success }]}>
                    {item.stock}
                  </Text>
                  <Text style={[styles.stockLabel, { color: isEmpty ? colors.danger : isLow ? colors.warning : colors.textDim }]}>
                    {isEmpty ? 'Sin stock' : isLow ? 'Poco' : 'uds'}
                  </Text>
                </View>
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                {item.description ? <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text> : null}
                <View style={styles.cardMeta}>
                  <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
                  <Text style={styles.minStock}>Mínimo: {item.min_stock}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/product/new')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, margin: 12, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  list: { paddingHorizontal: 12, paddingBottom: 90 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12,
  },
  cardEmpty: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  stockBadge: {
    width: 56, height: 56, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  stockNum: { fontSize: 20, fontWeight: '800' },
  stockLabel: { fontSize: 10, fontWeight: '600' },
  thumbContainer: { width: 56, height: 56, position: 'relative' },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbBadge: {
    position: 'absolute', bottom: -4, right: -4,
    minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg,
  },
  thumbBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white },
  cardInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  productDesc: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  productPrice: { fontSize: 14, fontWeight: '700', color: colors.primary },
  minStock: { fontSize: 11, color: colors.textDim },
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
});
