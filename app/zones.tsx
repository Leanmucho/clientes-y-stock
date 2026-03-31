import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Linking, Alert,
} from 'react-native';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClientsByZone, getTodayPendingByZone } from '../lib/database';
import { colors } from '../lib/colors';
import { formatCurrency, formatDate, getStatusColor } from '../lib/utils';
import { Loading } from '../components/Loading';

export default function ZonesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'ruta' | 'zonas'>('ruta');
  const [pendingByZone, setPendingByZone] = useState<any[]>([]);
  const [clientsByZone, setClientsByZone] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [pending, byZone] = await Promise.all([
      getTodayPendingByZone(),
      getClientsByZone(),
    ]);
    setPendingByZone(pending);
    setClientsByZone(byZone);
    const exp: Record<string, boolean> = {};
    [...pending.map((g: any) => `r-${g.zone}`), ...byZone.map((g: any) => g.zone)].forEach(k => { exp[k] = true; });
    setExpanded(exp);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getTodayPendingByZone(), getClientsByZone()]).then(([pending, byZone]) => {
      if (!active) return;
      setPendingByZone(pending);
      setClientsByZone(byZone);
      const exp: Record<string, boolean> = {};
      [...pending.map((g: any) => `r-${g.zone}`), ...byZone.map((g: any) => g.zone)].forEach(k => { exp[k] = true; });
      setExpanded(exp);
      setLoading(false);
    });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps.'));
  };

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return <Loading />;

  const totalPending = pendingByZone.reduce((acc, g) => acc + g.clients.length, 0);

  const filteredZones = clientsByZone.map((g: any) => ({
    ...g,
    clients: g.clients.filter((c: any) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.address ?? '').toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((g: any) => g.clients.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: 'Zonas y Rutas' }} />
      <View style={styles.container}>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'ruta' && styles.tabBtnActive]} onPress={() => setTab('ruta')}>
            <Ionicons name="navigate" size={15} color={tab === 'ruta' ? colors.white : colors.textDim} />
            <Text style={[styles.tabBtnText, tab === 'ruta' && styles.tabBtnTextActive]}>
              Ruta del día{totalPending > 0 ? ` (${totalPending})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'zonas' && styles.tabBtnActive]} onPress={() => setTab('zonas')}>
            <Ionicons name="map" size={15} color={tab === 'zonas' ? colors.white : colors.textDim} />
            <Text style={[styles.tabBtnText, tab === 'zonas' && styles.tabBtnTextActive]}>Por zona</Text>
          </TouchableOpacity>
        </View>

        {tab === 'zonas' && (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textDim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar cliente o dirección..."
              placeholderTextColor={colors.textDim}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {tab === 'ruta' ? (
            totalPending === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle" size={52} color={colors.success} />
                <Text style={styles.emptyTitle}>Sin cobros pendientes hoy</Text>
                <Text style={styles.emptySubtitle}>No hay cuotas vencidas ni para hoy</Text>
              </View>
            ) : (
              <>
                <View style={styles.infoBar}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
                  <Text style={styles.infoBarText}>
                    {totalPending} cobro{totalPending !== 1 ? 's' : ''} pendiente{totalPending !== 1 ? 's' : ''}, agrupados por zona. Tocá la dirección para abrir en Maps.
                  </Text>
                </View>
                {pendingByZone.map((group: any) => {
                  const key = `r-${group.zone}`;
                  const isOpen = expanded[key] !== false;
                  return (
                    <View key={group.zone} style={styles.zoneSection}>
                      <TouchableOpacity style={styles.zoneHeader} onPress={() => toggle(key)}>
                        <View style={styles.zonePill}>
                          <Ionicons name="location" size={13} color={colors.primary} />
                          <Text style={styles.zoneName}>{group.zone}</Text>
                        </View>
                        <View style={styles.zoneCountPill}>
                          <Text style={styles.zoneCountText}>{group.clients.length}</Text>
                        </View>
                        <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
                      </TouchableOpacity>
                      {isOpen && group.clients.map((c: any, idx: number) => (
                        <View key={`${c.client_id}-${c.installment_id}`} style={styles.pendingCard}>
                          <View style={styles.pendingIndex}>
                            <Text style={styles.pendingIndexText}>{idx + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <TouchableOpacity onPress={() => router.push(`/client/${c.client_id}`)}>
                              <Text style={styles.pendingName}>{c.client_name}</Text>
                            </TouchableOpacity>
                            {c.address ? (
                              <TouchableOpacity style={styles.addressRow} onPress={() => openMaps(c.address)}>
                                <Ionicons name="location-outline" size={12} color={colors.primary} />
                                <Text style={styles.addressText} numberOfLines={1}>{c.address}</Text>
                                <Ionicons name="open-outline" size={11} color={colors.primary} />
                              </TouchableOpacity>
                            ) : null}
                            {c.phone ? (
                              <TouchableOpacity
                                style={styles.phoneRow}
                                onPress={() => Linking.openURL(`tel:${c.phone}`)}
                              >
                                <Ionicons name="call-outline" size={12} color={colors.success} />
                                <Text style={styles.phoneText}>{c.phone}</Text>
                              </TouchableOpacity>
                            ) : null}
                            <Text style={styles.pendingDue}>Vence: {formatDate(c.due_date)}</Text>
                          </View>
                          <View style={styles.pendingRight}>
                            <Text style={styles.pendingAmount}>{formatCurrency(c.expected_amount)}</Text>
                            {c.paid_amount > 0 && (
                              <Text style={styles.pendingPaid}>Pagó: {formatCurrency(c.paid_amount)}</Text>
                            )}
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(c.status) }]} />
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            )
          ) : (
            filteredZones.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="map-outline" size={52} color={colors.textDim} />
                <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin zonas asignadas'}</Text>
                <Text style={styles.emptySubtitle}>
                  {search ? 'Probá otro término' : 'Agregá zona/barrio al crear o editar un cliente'}
                </Text>
              </View>
            ) : (
              filteredZones.map((group: any) => {
                const isOpen = expanded[group.zone] !== false;
                return (
                  <View key={group.zone} style={styles.zoneSection}>
                    <TouchableOpacity style={styles.zoneHeader} onPress={() => toggle(group.zone)}>
                      <View style={styles.zonePill}>
                        <Ionicons name="location" size={13} color={colors.primary} />
                        <Text style={styles.zoneName}>{group.zone}</Text>
                      </View>
                      <Text style={styles.zoneClientCount}>{group.clients.length} cliente{group.clients.length !== 1 ? 's' : ''}</Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
                    </TouchableOpacity>
                    {isOpen && group.clients.map((c: any) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.clientCard}
                        onPress={() => router.push(`/client/${c.id}`)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.clientAvatar}>
                          <Text style={styles.clientAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.clientName}>{c.name}</Text>
                          {c.address ? (
                            <TouchableOpacity
                              style={styles.addressRow}
                              onPress={(e: any) => { e.stopPropagation?.(); openMaps(c.address); }}
                            >
                              <Ionicons name="location-outline" size={12} color={colors.primary} />
                              <Text style={styles.addressText} numberOfLines={1}>{c.address}</Text>
                              <Ionicons name="open-outline" size={11} color={colors.primary} />
                            </TouchableOpacity>
                          ) : null}
                          {c.phone ? <Text style={styles.clientPhone}>{c.phone}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })
            )
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 8 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 10,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  tabBtnTextActive: { color: colors.white },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 4, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  content: { padding: 12, paddingBottom: 90 },
  infoBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.surface, borderRadius: 10, padding: 10, marginBottom: 12,
  },
  infoBarText: { fontSize: 12, color: colors.textDim, flex: 1, lineHeight: 16 },
  zoneSection: { marginBottom: 14 },
  zoneHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 6,
  },
  zonePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoneName: { fontSize: 15, fontWeight: '700', color: colors.text },
  zoneCountPill: {
    backgroundColor: colors.primary + '22', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  zoneCountText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  zoneClientCount: { fontSize: 12, color: colors.textDim },
  emptyCard: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingHorizontal: 20 },
  pendingCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: colors.warning,
  },
  pendingIndex: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center',
  },
  pendingIndexText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  pendingName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  addressText: { fontSize: 12, color: colors.primary, flex: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  phoneText: { fontSize: 12, color: colors.success },
  pendingDue: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  pendingRight: { alignItems: 'flex-end', gap: 3, minWidth: 80 },
  pendingAmount: { fontSize: 14, fontWeight: '800', color: colors.text },
  pendingPaid: { fontSize: 11, color: colors.success },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  clientCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
  },
  clientAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center',
  },
  clientAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  clientName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  clientPhone: { fontSize: 12, color: colors.textDim, marginTop: 1 },
});
