import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  TextInput, Image, ScrollView, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, getCategories, deleteCategory } from '../../lib/database';
import { Product, Category } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { BottomSheet } from '../../components/BottomSheet';

export default function StockScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [manageCats, setManageCats] = useState(false);

  const load = useCallback(async () => {
    const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
    setProducts(prods);
    setCategories(cats);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getProducts(), getCategories()])
      .then(([prods, cats]) => {
        if (!active) return;
        setProducts(prods);
        setCategories(cats);
        setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) return <Loading />;

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === null || p.category_id === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = products.filter(p => p.stock <= p.min_stock && p.stock > 0).length;
  const emptyCount = products.filter(p => p.stock === 0).length;

  const handleDeleteCategory = (cat: Category) => {
    const hasProducts = products.some(p => p.category_id === cat.id);
    Alert.alert(
      'Eliminar categoría',
      hasProducts
        ? `"${cat.name}" tiene productos asignados. Eliminá la categoría de esos productos primero.`
        : `¿Eliminar la categoría "${cat.name}"?`,
      hasProducts ? [{ text: 'Entendido' }] : [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              await load();
              if (selectedCategory === cat.id) setSelectedCategory(null);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'No se pudo eliminar.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
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

      {/* Category chips */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <TouchableOpacity
            style={[styles.chip, selectedCategory === null && styles.chipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.chipText, selectedCategory === null && styles.chipTextActive]}>
              Todos ({products.length})
            </Text>
          </TouchableOpacity>
          {categories.map(cat => {
            const count = products.filter(p => p.category_id === cat.id).length;
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedCategory(active ? null : cat.id)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.chipManage}
            onPress={() => setManageCats(true)}
          >
            <Ionicons name="settings-outline" size={13} color={colors.textDim} />
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Stock alerts bar */}
      {(lowStockCount > 0 || emptyCount > 0) && (
        <View style={styles.alertBar}>
          {emptyCount > 0 && (
            <View style={styles.alertItem}>
              <View style={[styles.alertDot, { backgroundColor: colors.danger }]} />
              <Text style={styles.alertText}>{emptyCount} sin stock</Text>
            </View>
          )}
          {lowStockCount > 0 && (
            <View style={styles.alertItem}>
              <View style={[styles.alertDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.alertText}>{lowStockCount} stock bajo</Text>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyTitle}>{search || selectedCategory ? 'Sin resultados' : 'Sin productos'}</Text>
            <Text style={styles.emptySubtitle}>
              {search || selectedCategory ? 'Probá con otros filtros' : 'Toca + para agregar tu primer producto'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLow = item.stock <= item.min_stock && item.stock > 0;
          const isEmpty = item.stock === 0;
          return (
            <TouchableOpacity
              style={[styles.card, isEmpty && styles.cardEmpty, isLow && styles.cardLow]}
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
                {item.category_name && (
                  <View style={styles.catTag}>
                    <Text style={styles.catTagText}>{item.category_name}</Text>
                  </View>
                )}
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

      {/* Manage categories */}
      <BottomSheet visible={manageCats} onClose={() => setManageCats(false)} title="Categorías">
        <View style={styles.sheetContent}>
          {categories.length === 0 ? (
            <Text style={styles.modalEmpty}>Sin categorías. Creá una al agregar un producto.</Text>
          ) : (
            categories.map(cat => (
              <View key={cat.id} style={styles.catRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catRowName}>{cat.name}</Text>
                  {cat.description ? <Text style={styles.catRowDesc}>{cat.description}</Text> : null}
                </View>
                <Text style={styles.catRowCount}>
                  {products.filter(p => p.category_id === cat.id).length} productos
                </Text>
                <TouchableOpacity onPress={() => handleDeleteCategory(cat)} style={styles.catRowDelete}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, margin: 12, marginBottom: 6, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  chipRow: { paddingHorizontal: 12, paddingVertical: 6, gap: 6, alignItems: 'center' },
  chip: {
    backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  chipManage: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  alertBar: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingBottom: 6,
  },
  alertItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  alertDot: { width: 7, height: 7, borderRadius: 4 },
  alertText: { fontSize: 11, color: colors.textDim },
  list: { paddingHorizontal: 12, paddingBottom: 90 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 12,
  },
  cardEmpty: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  cardLow: { borderLeftWidth: 3, borderLeftColor: colors.warning },
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
  catTag: {
    alignSelf: 'flex-start', backgroundColor: colors.primary + '22',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 3,
  },
  catTagText: { fontSize: 10, fontWeight: '700', color: colors.primary },
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
  sheetContent: { paddingHorizontal: 20, paddingBottom: 8 },
  modalEmpty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  catRowName: { fontSize: 14, fontWeight: '700', color: colors.text },
  catRowDesc: { fontSize: 12, color: colors.textDim, marginTop: 1 },
  catRowCount: { fontSize: 11, color: colors.textDim },
  catRowDelete: { padding: 4 },
});
