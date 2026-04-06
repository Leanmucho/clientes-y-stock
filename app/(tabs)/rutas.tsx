import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Linking, Alert, Modal, Share, Platform,
  LayoutAnimation, UIManager,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClientsByZone, getTodayPendingByZone } from '../../lib/database';
import { colors } from '../../lib/colors';
import { formatCurrency, formatDate, getStatusColor } from '../../lib/utils';
import { Loading } from '../../components/Loading';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingClient {
  client_id: number;
  client_name: string;
  address: string;
  phone: string;
  installment_id: number;
  expected_amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  sale_id: number;
}

interface PendingGroup {
  zone: string;
  clients: PendingClient[];
}

interface ZoneClient {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  zone?: string;
}

interface ZoneGroup {
  zone: string;
  clients: ZoneClient[];
}

interface RouteStop {
  id: string;
  clientId: number;
  clientName: string;
  address?: string;
  phone?: string;
  amount?: number;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMapsUrl(addresses: string[]): string {
  const valid = addresses.filter(a => a && a.trim().length > 0);
  if (valid.length === 0) return '';
  if (valid.length === 1)
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(valid[0])}`;
  return `https://www.google.com/maps/dir/${valid.map(a => encodeURIComponent(a)).join('/')}/`;
}

function todayLabel(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function buildShareMessage(stops: RouteStop[]): string {
  const total = stops.reduce((acc, s) => acc + (s.amount ?? 0), 0);
  const lines = stops.map((s, idx) => {
    const parts = [`${idx + 1}. ${s.clientName}`];
    if (s.address) {
      parts.push(`   📍 ${s.address}`);
      parts.push(`   🗺️ https://maps.google.com/?q=${encodeURIComponent(s.address)}`);
    }
    if (s.phone) parts.push(`   📱 ${s.phone}`);
    if (s.amount) parts.push(`   💰 ${formatCurrency(s.amount)}`);
    if (s.notes) parts.push(`   📝 ${s.notes}`);
    return parts.join('\n');
  });
  return [
    `🗺️ RUTA DEL DÍA — ${todayLabel()}`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `${stops.length} parada${stops.length !== 1 ? 's' : ''}${total > 0 ? ` · Total: ${formatCurrency(total)}` : ''}`,
    '',
    ...lines,
    '',
    'Generado con Clientes y Stock',
  ].join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RutasScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'ruta' | 'crear'>('ruta');
  const [pendingByZone, setPendingByZone] = useState<PendingGroup[]>([]);
  const [clientsByZone, setClientsByZone] = useState<ZoneGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Route building
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeModal, setRouteModal] = useState(false);

  const load = useCallback(async () => {
    const [pending, byZone] = await Promise.all([
      getTodayPendingByZone(),
      getClientsByZone(),
    ]);
    setPendingByZone(pending as PendingGroup[]);
    setClientsByZone(byZone as ZoneGroup[]);
    const exp: Record<string, boolean> = {};
    [...(pending as PendingGroup[]).map(g => `r-${g.zone}`),
      ...(byZone as ZoneGroup[]).map(g => g.zone),
    ].forEach(k => { exp[k] = true; });
    setExpanded(exp);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getTodayPendingByZone(), getClientsByZone()])
      .then(([pending, byZone]) => {
        if (!active) return;
        setPendingByZone(pending as PendingGroup[]);
        setClientsByZone(byZone as ZoneGroup[]);
        const exp: Record<string, boolean> = {};
        [...(pending as PendingGroup[]).map(g => `r-${g.zone}`),
          ...(byZone as ZoneGroup[]).map(g => g.zone),
        ].forEach(k => { exp[k] = true; });
        setExpanded(exp);
        setLoading(false);
      }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  }, [load]);

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps.'));
  };

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateStopNotes = (id: string, notes: string) => {
    setRouteStops(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
  };

  // ── Route stop helpers ──────────────────────────────────────────────────────

  const isInRoute = (id: string) => routeStops.some(s => s.id === id);

  const togglePendingStop = (c: PendingClient) => {
    const id = `p-${c.client_id}-${c.installment_id}`;
    setRouteStops(prev =>
      isInRoute(id)
        ? prev.filter(s => s.id !== id)
        : [...prev, {
            id,
            clientId: c.client_id,
            clientName: c.client_name,
            address: c.address,
            phone: c.phone,
            amount: c.expected_amount - c.paid_amount,
          }]
    );
  };

  const toggleClientStop = (c: ZoneClient) => {
    const id = `c-${c.id}`;
    setRouteStops(prev =>
      isInRoute(id)
        ? prev.filter(s => s.id !== id)
        : [...prev, {
            id,
            clientId: c.id,
            clientName: c.name,
            address: c.address,
            phone: c.phone,
          }]
    );
  };

  const moveStop = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= routeStops.length) return;
    setRouteStops(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const openRouteModal = () => {
    if (routeStops.length === 0) return Alert.alert('Sin paradas', 'Seleccioná al menos un cliente para armar la ruta.');
    setRouteModal(true);
  };

  const handleOpenMapsRoute = () => {
    const addresses = routeStops.map(s => s.address ?? '').filter(Boolean);
    if (addresses.length === 0) return Alert.alert('Sin direcciones', 'Los clientes seleccionados no tienen dirección registrada.');
    const url = buildMapsUrl(addresses);
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps.'));
  };

  const handleShare = async () => {
    const msg = buildShareMessage(routeStops);
    try { await Share.share({ message: msg }); } catch {}
  };

  const handleWhatsApp = () => {
    const msg = buildShareMessage(routeStops);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
  };

  const handleFullRoute = () => {
    const allAddresses = pendingByZone
      .flatMap(g => g.clients)
      .map(c => c.address)
      .filter(Boolean) as string[];
    if (allAddresses.length === 0)
      return Alert.alert('Sin direcciones', 'Ningún cliente pendiente tiene dirección registrada.');
    Linking.openURL(buildMapsUrl(allAddresses))
      .catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps.'));
  };

  const clearRoute = () => { setRouteStops([]); setRouteModal(false); };

  if (loading) return <Loading />;

  const totalPending = pendingByZone.reduce((acc, g) => acc + g.clients.length, 0);
  const routeTotal = routeStops.reduce((acc, s) => acc + (s.amount ?? 0), 0);

  const filteredZones = clientsByZone.map(g => ({
    ...g,
    clients: g.clients.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.address ?? '').toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.clients.length > 0);

  return (
    <View style={styles.container}>
      {/* ── Tab switcher ─────────────────────────────────────────── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'ruta' && styles.tabBtnActive]}
          onPress={() => setTab('ruta')}
        >
          <Ionicons name="navigate" size={15} color={tab === 'ruta' ? colors.white : colors.textDim} />
          <Text style={[styles.tabBtnText, tab === 'ruta' && styles.tabBtnTextActive]}>
            Ruta del día{totalPending > 0 ? ` (${totalPending})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'crear' && styles.tabBtnActive]}
          onPress={() => setTab('crear')}
        >
          <Ionicons name="map" size={15} color={tab === 'crear' ? colors.white : colors.textDim} />
          <Text style={[styles.tabBtnText, tab === 'crear' && styles.tabBtnTextActive]}>Crear ruta</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search (crear tab) ───────────────────────────────────── */}
      {tab === 'crear' && (
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

      {/* ── Route bar (when stops selected) ─────────────────────── */}
      {routeStops.length > 0 && (
        <View style={styles.routeBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.routeBarCount}>
              {routeStops.length} parada{routeStops.length !== 1 ? 's' : ''}
            </Text>
            {routeTotal > 0 && (
              <Text style={styles.routeBarTotal}>Total: {formatCurrency(routeTotal)}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.routeBarBtn} onPress={openRouteModal}>
            <Ionicons name="navigate" size={14} color={colors.white} />
            <Text style={styles.routeBarBtnText}>Ver ruta</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.routeBarClear} onPress={clearRoute}>
            <Ionicons name="close" size={16} color={colors.textDim} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, routeStops.length > 0 && { paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ════════════════════════════════════════════════════════════
            TAB: RUTA DEL DÍA
        ════════════════════════════════════════════════════════════ */}
        {tab === 'ruta' && (
          totalPending === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle" size={52} color={colors.success} />
              <Text style={styles.emptyTitle}>Sin cobros pendientes hoy</Text>
              <Text style={styles.emptySubtitle}>No hay cuotas vencidas ni para hoy</Text>
            </View>
          ) : (
            <>
              {/* Start full route button */}
              <TouchableOpacity style={styles.fullRouteBanner} onPress={handleFullRoute} activeOpacity={0.8}>
                <Ionicons name="navigate" size={16} color={colors.white} />
                <Text style={styles.fullRouteText}>
                  Iniciar recorrido completo ({totalPending} paradas)
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.white + 'aa'} />
              </TouchableOpacity>

              <Text style={styles.sectionHint}>
                Tocá los clientes para agregarlos a una ruta personalizada
              </Text>

              {pendingByZone.map((group) => {
                const key = `r-${group.zone}`;
                const isOpen = expanded[key] !== false;
                const groupAddresses = group.clients.map(c => c.address).filter(Boolean) as string[];

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
                      {groupAddresses.length > 0 && (
                        <TouchableOpacity
                          style={styles.zoneMapBtn}
                          onPress={() => Linking.openURL(buildMapsUrl(groupAddresses)).catch(() => {})}
                        >
                          <Ionicons name="map" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
                    </TouchableOpacity>

                    {isOpen && group.clients.map((c) => {
                      const stopId = `p-${c.client_id}-${c.installment_id}`;
                      const selected = isInRoute(stopId);
                      const owed = c.expected_amount - c.paid_amount;
                      return (
                        <TouchableOpacity
                          key={stopId}
                          style={[styles.pendingCard, selected && styles.pendingCardSelected]}
                          onPress={() => togglePendingStop(c)}
                          activeOpacity={0.75}
                        >
                          {/* Selection circle */}
                          <View style={[styles.selCircle, selected && styles.selCircleActive]}>
                            {selected ? (
                              <Text style={styles.selCircleNum}>
                                {routeStops.findIndex(s => s.id === stopId) + 1}
                              </Text>
                            ) : (
                              <Ionicons name="add" size={14} color={colors.textDim} />
                            )}
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
                              <TouchableOpacity style={styles.phoneRow} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                                <Ionicons name="call-outline" size={12} color={colors.success} />
                                <Text style={styles.phoneText}>{c.phone}</Text>
                              </TouchableOpacity>
                            ) : null}
                            <Text style={styles.pendingDue}>Vence: {formatDate(c.due_date)}</Text>
                          </View>

                          <View style={styles.pendingRight}>
                            <Text style={styles.pendingAmount}>{formatCurrency(owed)}</Text>
                            {c.paid_amount > 0 && (
                              <Text style={styles.pendingPaid}>Pagó: {formatCurrency(c.paid_amount)}</Text>
                            )}
                            <View style={[styles.statusDot, { backgroundColor: getStatusColor(c.status) }]} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB: CREAR RUTA (todos los clientes)
        ════════════════════════════════════════════════════════════ */}
        {tab === 'crear' && (
          filteredZones.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={52} color={colors.textDim} />
              <Text style={styles.emptyTitle}>{search ? 'Sin resultados' : 'Sin clientes con zona asignada'}</Text>
              <Text style={styles.emptySubtitle}>
                {search ? 'Probá otro término' : 'Agregá zona/barrio al crear o editar un cliente'}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionHint}>
                Seleccioná clientes para armar una ruta personalizada
              </Text>
              {filteredZones.map((group) => {
                const isOpen = expanded[group.zone] !== false;
                return (
                  <View key={group.zone} style={styles.zoneSection}>
                    <TouchableOpacity style={styles.zoneHeader} onPress={() => toggle(group.zone)}>
                      <View style={styles.zonePill}>
                        <Ionicons name="location" size={13} color={colors.primary} />
                        <Text style={styles.zoneName}>{group.zone}</Text>
                      </View>
                      <Text style={styles.zoneClientCount}>
                        {group.clients.length} cliente{group.clients.length !== 1 ? 's' : ''}
                      </Text>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
                    </TouchableOpacity>

                    {isOpen && group.clients.map((c) => {
                      const stopId = `c-${c.id}`;
                      const selected = isInRoute(stopId);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.clientCard, selected && styles.pendingCardSelected]}
                          onPress={() => toggleClientStop(c)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.selCircle, selected && styles.selCircleActive]}>
                            {selected ? (
                              <Text style={styles.selCircleNum}>
                                {routeStops.findIndex(s => s.id === stopId) + 1}
                              </Text>
                            ) : (
                              <Ionicons name="add" size={14} color={colors.textDim} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.clientName}>{c.name}</Text>
                            {c.address ? (
                              <TouchableOpacity
                                style={styles.addressRow}
                                onPress={() => openMaps(c.address!)}
                              >
                                <Ionicons name="location-outline" size={12} color={colors.primary} />
                                <Text style={styles.addressText} numberOfLines={1}>{c.address}</Text>
                                <Ionicons name="open-outline" size={11} color={colors.primary} />
                              </TouchableOpacity>
                            ) : null}
                            {c.phone ? <Text style={styles.clientPhone}>{c.phone}</Text> : null}
                          </View>
                          <TouchableOpacity
                            onPress={() => router.push(`/client/${c.id}`)}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </>
          )
        )}
      </ScrollView>

      {/* ── Route modal ──────────────────────────────────────────── */}
      <Modal visible={routeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                Ruta — {routeStops.length} parada{routeStops.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={() => setRouteModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            {routeTotal > 0 && (
              <Text style={styles.modalSubtitle}>Total a cobrar: {formatCurrency(routeTotal)}</Text>
            )}

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {routeStops.map((stop, idx) => (
                <View key={stop.id} style={styles.stopCard}>
                  <View style={styles.stopRow}>
                    <View style={styles.stopBadge}>
                      <Text style={styles.stopBadgeText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopName}>{stop.clientName}</Text>
                      {stop.address ? (
                        <TouchableOpacity
                          style={styles.stopAddressRow}
                          onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(stop.address!)}`).catch(() => {})}
                        >
                          <Ionicons name="location-outline" size={12} color={colors.primary} />
                          <Text style={styles.stopAddress} numberOfLines={1}>{stop.address}</Text>
                          <Ionicons name="open-outline" size={11} color={colors.primary} />
                        </TouchableOpacity>
                      ) : null}
                      {stop.phone ? (
                        <Text style={styles.stopPhone}>📱 {stop.phone}</Text>
                      ) : null}
                      {stop.amount ? (
                        <Text style={styles.stopAmount}>💰 {formatCurrency(stop.amount)}</Text>
                      ) : null}
                    </View>
                    <View style={styles.reorderBtns}>
                      <TouchableOpacity
                        style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                        onPress={() => moveStop(idx, -1)}
                        disabled={idx === 0}
                      >
                        <Ionicons name="chevron-up" size={16} color={idx === 0 ? colors.textDim : colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.reorderBtn, idx === routeStops.length - 1 && styles.reorderBtnDisabled]}
                        onPress={() => moveStop(idx, 1)}
                        disabled={idx === routeStops.length - 1}
                      >
                        <Ionicons name="chevron-down" size={16} color={idx === routeStops.length - 1 ? colors.textDim : colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TextInput
                    style={styles.stopNotes}
                    placeholder="Indicaciones para el repartidor..."
                    placeholderTextColor={colors.textDim}
                    value={stop.notes ?? ''}
                    onChangeText={(text) => updateStopNotes(stop.id, text)}
                    multiline
                  />
                </View>
              ))}
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleOpenMapsRoute} activeOpacity={0.8}>
                <Ionicons name="navigate" size={16} color={colors.white} />
                <Text style={styles.actionBtnText}>Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-social" size={16} color={colors.white} />
                <Text style={styles.actionBtnText}>Compartir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={handleWhatsApp} activeOpacity={0.8}>
                <Ionicons name="logo-whatsapp" size={16} color={colors.white} />
                <Text style={styles.actionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.clearBtn} onPress={clearRoute}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <Text style={styles.clearBtnText}>Limpiar ruta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Tabs
  tabRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 8 },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 10,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  tabBtnTextActive: { color: colors.white },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  // Route bar
  routeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary + '22', marginHorizontal: 12, marginBottom: 4,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.primary + '55',
  },
  routeBarCount: { fontSize: 13, fontWeight: '700', color: colors.primary },
  routeBarTotal: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  routeBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
  },
  routeBarBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  routeBarClear: { padding: 4 },

  // Content
  content: { padding: 12, paddingBottom: 30 },
  sectionHint: { fontSize: 12, color: colors.textDim, marginBottom: 10, marginLeft: 4 },

  // Full route banner
  fullRouteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, padding: 14, marginBottom: 12,
  },
  fullRouteText: { flex: 1, color: colors.white, fontWeight: '700', fontSize: 14 },

  // Zone sections
  zoneSection: { marginBottom: 14 },
  zoneHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, marginBottom: 6,
  },
  zonePill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  zoneName: { fontSize: 15, fontWeight: '700', color: colors.text },
  zoneCountPill: {
    backgroundColor: colors.primary + '22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
  },
  zoneCountText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  zoneClientCount: { fontSize: 12, color: colors.textDim },
  zoneMapBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center',
  },

  // Selection circle
  selCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  selCircleActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
  selCircleNum: { fontSize: 12, fontWeight: '800', color: colors.white },

  // Pending cards
  pendingCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: colors.warning,
  },
  pendingCardSelected: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.primary + '11',
  },
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

  // Client cards (crear tab)
  clientCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
  },
  clientName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  clientPhone: { fontSize: 12, color: colors.textDim, marginTop: 1 },

  // Empty
  emptyCard: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingHorizontal: 20 },

  // Route modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000077' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 12 },

  // Stop cards
  stopCard: {
    backgroundColor: colors.bg, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stopBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  stopBadgeText: { fontSize: 13, fontWeight: '800', color: colors.white },
  stopName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  stopAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 1 },
  stopAddress: { fontSize: 12, color: colors.primary, flex: 1 },
  stopPhone: { fontSize: 12, color: colors.textMuted, marginBottom: 1 },
  stopAmount: { fontSize: 12, color: colors.success, fontWeight: '700' },
  stopNotes: {
    marginTop: 8, marginLeft: 40, fontSize: 12, color: colors.text,
    backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, minHeight: 32,
  },

  // Reorder
  reorderBtns: { gap: 2 },
  reorderBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.primary + '22', justifyContent: 'center', alignItems: 'center',
  },
  reorderBtnDisabled: { backgroundColor: colors.border + '44' },

  // Modal actions
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12,
  },
  actionBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 10,
  },
  clearBtnText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
