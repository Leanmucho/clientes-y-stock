import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, Image, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, bulkUpdateStockByName } from '../../lib/database';
import { Product } from '../../types';
import { colors } from '../../lib/colors';
import { formatCurrency } from '../../lib/utils';
import { Loading } from '../../components/Loading';
import { BottomSheet } from '../../components/BottomSheet';

const CSV_EXAMPLE = `Producto A,10\nProducto B,5\nProducto C,0`;

function parseCSVText(text: string): { name: string; stock: number }[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split(',');
      const name = parts[0]?.trim() ?? '';
      const stock = parseInt(parts[1]?.trim() ?? '', 10);
      return { name, stock };
    })
    .filter(row => row.name.length > 0 && !isNaN(row.stock) && row.stock >= 0);
}

export default function StockScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Import sheet state
  const [importSheet, setImportSheet] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const data = await getProducts();
    setProducts(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    getProducts().then((data) => { if (active) { setProducts(data); setLoading(false); } });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleImport = async () => {
    const rows = parseCSVText(csvText);
    if (rows.length === 0) {
      Alert.alert('Formato incorrecto', 'Pegá el texto en formato:\nNombre del producto,stock_nuevo\nUna línea por producto.');
      return;
    }
    setImporting(true);
    try {
      const { updated, notFound } = await bulkUpdateStockByName(rows);
      setImportSheet(false);
      setCsvText('');
      await load();
      const msg = notFound.length > 0
        ? `${updated} producto(s) actualizado(s).\n\nNo encontrados:\n${notFound.join(', ')}`
        : `${updated} producto(s) actualizado(s) correctamente.`;
      Alert.alert('Importación completada', msg);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo importar.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <Loading />;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const lowCount = products.filter(p => p.stock > 0 && p.stock <= p.min_stock).length;
  const emptyCount = products.filter(p => p.stock === 0).length;

  return (
    <View style={styles.container}>
      {/* Search + Import button */}
      <View style={styles.topRow}>
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
        <TouchableOpacity style={styles.importBtn} onPress={() => setImportSheet(true)} activeOpacity={0.8}>
          <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stock alerts bar */}
      {(emptyCount > 0 || lowCount > 0) && (
        <View style={styles.alertsRow}>
          {emptyCount > 0 && (
            <View style={[styles.alertChip, { backgroundColor: colors.danger + '18', borderColor: colors.danger + '44' }]}>
              <Ionicons name="alert-circle" size={13} color={colors.danger} />
              <Text style={[styles.alertChipText, { color: colors.danger }]}>{emptyCount} sin stock</Text>
            </View>
          )}
          {lowCount > 0 && (
            <View style={[styles.alertChip, { backgroundColor: colors.warning + '18', borderColor: colors.warning + '44' }]}>
              <Ionicons name="warning" size={13} color={colors.warning} />
              <Text style={[styles.alertChipText, { color: colors.warning }]}>{lowCount} stock bajo</Text>
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
            <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin productos'}</Text>
            <Text style={styles.emptySubtitle}>Toca + para agregar tu primer producto</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLow = item.stock > 0 && item.stock <= item.min_stock;
          const isEmpty = item.stock === 0;
          return (
            <TouchableOpacity
              style={[styles.card, isEmpty && styles.cardEmpty, isLow && !isEmpty && styles.cardLow]}
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

      {/* Import stock sheet */}
      <BottomSheet visible={importSheet} onClose={() => { setImportSheet(false); setCsvText(''); }} title="Importar stock">
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.importContent}>
            <View style={styles.importInfo}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.importInfoText}>
                Pegá el contenido de tu planilla en formato CSV:{'\n'}
                <Text style={styles.importCode}>Nombre del producto,stock_nuevo</Text>
              </Text>
            </View>

            <View style={styles.importExampleBox}>
              <Text style={styles.importExampleLabel}>Ejemplo:</Text>
              <Text style={styles.importExampleText}>{CSV_EXAMPLE}</Text>
            </View>

            <Text style={styles.importLabel}>Pegá aquí tu CSV:</Text>
            <TextInput
              style={styles.importTextArea}
              value={csvText}
              onChangeText={setCsvText}
              placeholder={'Producto A,10\nProducto B,5\n...'}
              placeholderTextColor={colors.textDim}
              multiline
              textAlignVertical="top"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {csvText.length > 0 && (
              <Text style={styles.importPreviewCount}>
                {parseCSVText(csvText).length} línea(s) válida(s) detectadas
              </Text>
            )}

            <TouchableOpacity
              style={[styles.importApplyBtn, (importing || csvText.trim().length === 0) && styles.importApplyBtnDisabled]}
              onPress={handleImport}
              disabled={importing || csvText.trim().length === 0}
              activeOpacity={0.8}
            >
              {importing
                ? <ActivityIndicator color={colors.white} />
                : <>
                    <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                    <Text style={styles.importApplyBtnText}>Aplicar cambios</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 6 },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  importBtn: {
    backgroundColor: colors.surface, borderRadius: 12,
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
  },
  alertsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 6 },
  alertChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  alertChipText: { fontSize: 12, fontWeight: '700' },
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
  // Import sheet
  importContent: { gap: 12, paddingBottom: 24 },
  importInfo: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.primary + '12', borderRadius: 12, padding: 12,
  },
  importInfoText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 20 },
  importCode: { fontFamily: 'monospace', color: colors.primary, fontWeight: '600' },
  importExampleBox: {
    backgroundColor: colors.bg, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  importExampleLabel: { fontSize: 11, fontWeight: '700', color: colors.textDim, marginBottom: 4 },
  importExampleText: { fontFamily: 'monospace', fontSize: 12, color: colors.textMuted, lineHeight: 20 },
  importLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  importTextArea: {
    backgroundColor: colors.bg, borderRadius: 12, padding: 12,
    color: colors.text, fontSize: 13, minHeight: 120,
    borderWidth: 1, borderColor: colors.border, fontFamily: 'monospace',
  },
  importPreviewCount: { fontSize: 12, color: colors.primary, fontWeight: '600', textAlign: 'center' },
  importApplyBtn: {
    backgroundColor: colors.primary, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  importApplyBtnDisabled: { opacity: 0.5 },
  importApplyBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },
});
