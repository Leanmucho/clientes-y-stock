import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Linking, Alert, Modal,
  Share, SafeAreaView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getClientsByZone, getTodayPendingByZone } from '../lib/database';
import { colors } from '../lib/colors';
import { formatCurrency, formatDate, getStatusColor } from '../lib/utils';
import { Loading } from '../components/Loading';

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

// A stop in the custom route — carries the pending client data
interface RouteStop {
  selectionKey: string; // `${client_id}-${installment_id}`
  client: PendingClient;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMapsUrl(addresses: string[]): string {
  const valid = addresses.filter(a => a && a.trim().length > 0);
  if (valid.length === 0) return '';
  if (valid.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(valid[0])}`;
  }
  const parts = valid.map(a => encodeURIComponent(a)).join('/');
  return `https://www.google.com/maps/dir/${parts}/`;
}

function formatRouteDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function buildShareMessage(stops: RouteStop[], date: string): string {
  const total = stops.reduce((acc, s) => acc + (s.client.expected_amount ?? 0), 0);
  const lines = stops.map((s, idx) => {
    const c = s.client;
    const parts = [`${idx + 1}. ${c.client_name}`];
    if (c.address) parts.push(`   📍 ${c.address}`);
    if (c.phone) parts.push(`   📱 ${c.phone}`);
    parts.push(`   💰 ${formatCurrency(c.expected_amount)}`);
    return parts.join('\n');
  });

  return [
    `🗺️ RUTA DEL DÍA — ${formatRouteDate(date)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    `${stops.length} parada${stops.length !== 1 ? 's' : ''} · Total: ${formatCurrency(total)}`,
    '',
    ...lines,
    '',
    'Generado con Clientes y Stock',
  ].join('\n');
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ZonesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'ruta' | 'zonas'>('ruta');
  const [pendingByZone, setPendingByZone] = useState<PendingGroup[]>([]);
  const [clientsByZone, setClientsByZone] = useState<ZoneGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Route selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [routeModal, setRouteModal] = useState(false);
  // Ordered list of stops for the route modal
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);

  const load = useCallback(async () => {
    const [pending, byZone] = await Promise.all([
      getTodayPendingByZone(),
      getClientsByZone(),
    ]);
    setPendingByZone(pending as PendingGroup[]);
    setClientsByZone(byZone as ZoneGroup[]);
    const exp: Record<string, boolean> = {};
    [
      ...(pending as PendingGroup[]).map(g => `r-${g.zone}`),
      ...(byZone as ZoneGroup[]).map(g => g.zone),
    ].forEach(k => { exp[k] = true; });
    setExpanded(exp);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getTodayPendingByZone(), getClientsByZone()]).then(([pending, byZone]) => {
      if (!active) return;
      setPendingByZone(pending as PendingGroup[]);
      setClientsByZone(byZone as ZoneGroup[]);
      const exp: Record<string, boolean> = {};
      [
        ...(pending as PendingGroup[]).map((g: PendingGroup) => `r-${g.zone}`),
        ...(byZone as ZoneGroup[]).map((g: ZoneGroup) => g.zone),
      ].forEach(k => { exp[k] = true; });
      setExpanded(exp);
      setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps.'));
  };

  const openMapsMulti = (addresses: string[]) => {
    const url = buildMapsUrl(addresses);
    if (!url) {
      Alert.alert('Sin direcciones', 'No hay direcciones disponibles para abrir en Maps.');
      return;
    }
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir Google Maps.'));
  };

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Selection helpers ───────────────────────────────────────────────────────

  const toggleSelection = (key: string, client: PendingClient) => {
    setSelectedIds(prev => {
      if (prev.includes(key)) {
        return prev.filter(id => id !== key);
      }
      return [...prev, key];
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const openRouteModal = () => {
    // Build ordered stops from selectedIds preserving insertion order
    const allClients: PendingClient[] = pendingByZone.flatMap(g => g.clients);
    const stops: RouteStop[] = selectedIds
      .map(key => {
        const c = allClients.find(
          cl => `${cl.client_id}-${cl.installment_id}` === key,
        );
        if (!c) return null;
        return { selectionKey: key, client: c } as RouteStop;
      })
      .filter((s): s is RouteStop => s !== null);
    setRouteStops(stops);
    setRouteModal(true);
  };

  const moveStop = (index: number, direction: 'up' | 'down') => {
    setRouteStops(prev => {
      const next = [...prev];
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
  };

  const shareRoute = async () => {
    const message = buildShareMessage(routeStops, todayIso());
    try {
      await Share.share({ message });
    } catch {
      // dismissed
    }
  };

  const openWhatsApp = () => {
    const message = buildShareMessage(routeStops, todayIso());
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
  };

  const openRouteMaps = () => {
    const addresses = routeStops.map(s => s.client.address).filter(Boolean) as string[];
    openMapsMulti(addresses);
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  if (loading) return <Loading />;

  const totalPending = pendingByZone.reduce((acc, g) => acc + g.clients.length, 0);

  const filteredZones = clientsByZone
    .map(g => ({
      ...g,
      clients: g.clients.filter(
        c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.address ?? '').toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter(g => g.clients.length > 0);

  const selectedCount = selectedIds.length;
  const allPendingClients = pendingByZone.flatMap(g => g.clients);
  const selectedTotal = selectedIds.reduce((acc, key) => {
    const c = allPendingClients.find(cl => `${cl.client_id}-${cl.installment_id}` === key);
    return acc + (c?.expected_amount ?? 0);
  }, 0);

  // All pending addresses for "Iniciar recorrido completo"
  const allPendingAddresses = pendingByZone
    .flatMap(g => g.clients.map(c => c.address))
    .filter(Boolean) as string[];

  return (
    <>
      <Stack.Screen options={{ title: 'Zonas y Rutas' }} />
      <View style={styles.container}>
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
            style={[styles.tabBtn, tab === 'zonas' && styles.tabBtnActive]}
            onPress={() => setTab('zonas')}
          >
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
          contentContainerStyle={[
            styles.content,
            selectionMode && { paddingBottom: 130 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
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
                {/* Iniciar recorrido completo banner */}
                {!selectionMode && allPendingAddresses.length > 0 && (
                  <TouchableOpacity
                    style={styles.fullRouteBanner}
                    onPress={() => openMapsMulti(allPendingAddresses)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="navigate" size={16} color={colors.white} />
                    <Text style={styles.fullRouteBannerText}>
                      Iniciar recorrido completo ({allPendingAddresses.length} paradas)
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.white} />
                  </TouchableOpacity>
                )}

                {/* Info bar + selection toggle */}
                <View style={styles.infoBarRow}>
                  <View style={styles.infoBar}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
                    <Text style={styles.infoBarText}>
                      {totalPending} cobro{totalPending !== 1 ? 's' : ''} pendiente{totalPending !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.selectionToggleBtn, selectionMode && styles.selectionToggleBtnActive]}
                    onPress={() => {
                      if (selectionMode) {
                        exitSelectionMode();
                      } else {
                        setSelectionMode(true);
                      }
                    }}
                  >
                    <Ionicons
                      name={selectionMode ? 'close' : 'checkmark-done-outline'}
                      size={14}
                      color={selectionMode ? colors.danger : colors.primary}
                    />
                    <Text style={[styles.selectionToggleBtnText, selectionMode && { color: colors.danger }]}>
                      {selectionMode ? 'Cancelar' : 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {pendingByZone.map(group => {
                  const key = `r-${group.zone}`;
                  const isOpen = expanded[key] !== false;
                  const zoneAddresses = group.clients
                    .map(c => c.address)
                    .filter(Boolean) as string[];
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
                        {/* Zone-specific Maps button */}
                        {zoneAddresses.length > 0 && (
                          <TouchableOpacity
                            style={styles.zoneMapsBtn}
                            onPress={e => {
                              e.stopPropagation?.();
                              openMapsMulti(zoneAddresses);
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="map" size={15} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        <Ionicons
                          name={isOpen ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={colors.textDim}
                        />
                      </TouchableOpacity>

                      {isOpen &&
                        group.clients.map((c, idx) => {
                          const selKey = `${c.client_id}-${c.installment_id}`;
                          const isSelected = selectedIds.includes(selKey);
                          const selectionIndex = selectedIds.indexOf(selKey);
                          return (
                            <TouchableOpacity
                              key={selKey}
                              style={[
                                styles.pendingCard,
                                isSelected && styles.pendingCardSelected,
                              ]}
                              onPress={() => {
                                if (selectionMode) {
                                  toggleSelection(selKey, c);
                                } else {
                                  router.push(`/client/${c.client_id}`);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              {/* Selection circle or index */}
                              {selectionMode ? (
                                <View
                                  style={[
                                    styles.selectionCircle,
                                    isSelected && styles.selectionCircleFilled,
                                  ]}
                                >
                                  {isSelected && (
                                    <Text style={styles.selectionCircleText}>
                                      {selectionIndex + 1}
                                    </Text>
                                  )}
                                </View>
                              ) : (
                                <View style={styles.pendingIndex}>
                                  <Text style={styles.pendingIndexText}>{idx + 1}</Text>
                                </View>
                              )}

                              <View style={{ flex: 1 }}>
                                <TouchableOpacity
                                  onPress={() => {
                                    if (!selectionMode) router.push(`/client/${c.client_id}`);
                                  }}
                                >
                                  <Text style={styles.pendingName}>{c.client_name}</Text>
                                </TouchableOpacity>
                                {c.address ? (
                                  <TouchableOpacity
                                    style={styles.addressRow}
                                    onPress={() => {
                                      if (!selectionMode) openMaps(c.address);
                                    }}
                                  >
                                    <Ionicons name="location-outline" size={12} color={colors.primary} />
                                    <Text style={styles.addressText} numberOfLines={1}>
                                      {c.address}
                                    </Text>
                                    {!selectionMode && (
                                      <Ionicons name="open-outline" size={11} color={colors.primary} />
                                    )}
                                  </TouchableOpacity>
                                ) : null}
                                {c.phone ? (
                                  <TouchableOpacity
                                    style={styles.phoneRow}
                                    onPress={() => {
                                      if (!selectionMode) Linking.openURL(`tel:${c.phone}`);
                                    }}
                                  >
                                    <Ionicons name="call-outline" size={12} color={colors.success} />
                                    <Text style={styles.phoneText}>{c.phone}</Text>
                                  </TouchableOpacity>
                                ) : null}
                                <Text style={styles.pendingDue}>Vence: {formatDate(c.due_date)}</Text>
                              </View>

                              <View style={styles.pendingRight}>
                                <Text style={styles.pendingAmount}>
                                  {formatCurrency(c.expected_amount)}
                                </Text>
                                {c.paid_amount > 0 && (
                                  <Text style={styles.pendingPaid}>
                                    Pagó: {formatCurrency(c.paid_amount)}
                                  </Text>
                                )}
                                <View
                                  style={[
                                    styles.statusDot,
                                    { backgroundColor: getStatusColor(c.status) },
                                  ]}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  );
                })}
              </>
            )
          ) : filteredZones.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="map-outline" size={52} color={colors.textDim} />
              <Text style={styles.emptyTitle}>
                {search ? 'Sin resultados' : 'Sin zonas asignadas'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? 'Probá otro término'
                  : 'Agregá zona/barrio al crear o editar un cliente'}
              </Text>
            </View>
          ) : (
            filteredZones.map(group => {
              const isOpen = expanded[group.zone] !== false;
              return (
                <View key={group.zone} style={styles.zoneSection}>
                  <TouchableOpacity
                    style={styles.zoneHeader}
                    onPress={() => toggle(group.zone)}
                  >
                    <View style={styles.zonePill}>
                      <Ionicons name="location" size={13} color={colors.primary} />
                      <Text style={styles.zoneName}>{group.zone}</Text>
                    </View>
                    <Text style={styles.zoneClientCount}>
                      {group.clients.length} cliente{group.clients.length !== 1 ? 's' : ''}
                    </Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textDim}
                    />
                  </TouchableOpacity>
                  {isOpen &&
                    group.clients.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.clientCard}
                        onPress={() => router.push(`/client/${c.id}`)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.clientAvatar}>
                          <Text style={styles.clientAvatarText}>
                            {c.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.clientName}>{c.name}</Text>
                          {c.address ? (
                            <TouchableOpacity
                              style={styles.addressRow}
                              onPress={(e: any) => {
                                e.stopPropagation?.();
                                openMaps(c.address!);
                              }}
                            >
                              <Ionicons name="location-outline" size={12} color={colors.primary} />
                              <Text style={styles.addressText} numberOfLines={1}>
                                {c.address}
                              </Text>
                              <Ionicons name="open-outline" size={11} color={colors.primary} />
                            </TouchableOpacity>
                          ) : null}
                          {c.phone ? (
                            <Text style={styles.clientPhone}>{c.phone}</Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                      </TouchableOpacity>
                    ))}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* ── Floating selection bar ──────────────────────────────────────────── */}
        {selectionMode && (
          <View style={styles.floatingBar}>
            <View style={styles.floatingBarInfo}>
              <Text style={styles.floatingBarCount}>
                {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
              </Text>
              {selectedCount > 0 && (
                <Text style={styles.floatingBarTotal}>{formatCurrency(selectedTotal)}</Text>
              )}
            </View>
            <View style={styles.floatingBarActions}>
              <TouchableOpacity
                style={[styles.floatingBtn, styles.floatingBtnSecondary]}
                onPress={exitSelectionMode}
              >
                <Text style={styles.floatingBtnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.floatingBtn,
                  styles.floatingBtnPrimary,
                  selectedCount === 0 && styles.floatingBtnDisabled,
                ]}
                onPress={() => {
                  if (selectedCount > 0) openRouteModal();
                }}
                disabled={selectedCount === 0}
              >
                <Ionicons name="navigate" size={14} color={colors.white} />
                <Text style={styles.floatingBtnPrimaryText}>Ver ruta</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Route modal ────────────────────────────────────────────────────────── */}
      <Modal
        visible={routeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRouteModal(false)}
      >
        <View style={styles.routeModalOverlay}>
          <View style={styles.routeModalSheet}>
            {/* Handle */}
            <View style={styles.routeModalHandle} />

            {/* Header */}
            <View style={styles.routeModalHeader}>
              <Text style={styles.routeModalTitle}>
                Ruta personalizada ({routeStops.length} parada{routeStops.length !== 1 ? 's' : ''})
              </Text>
              <TouchableOpacity
                onPress={() => setRouteModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Stop list */}
            <ScrollView
              style={styles.routeStopList}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {routeStops.map((stop, idx) => {
                const c = stop.client;
                return (
                  <View key={stop.selectionKey} style={styles.routeStopCard}>
                    <View style={styles.routeStopBadge}>
                      <Text style={styles.routeStopBadgeText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeStopName}>{c.client_name}</Text>
                      {c.address ? (
                        <Text style={styles.routeStopAddress} numberOfLines={1}>
                          📍 {c.address}
                        </Text>
                      ) : null}
                      {c.phone ? (
                        <Text style={styles.routeStopPhone}>📱 {c.phone}</Text>
                      ) : null}
                      <Text style={styles.routeStopAmount}>
                        💰 {formatCurrency(c.expected_amount)}
                      </Text>
                    </View>
                    <View style={styles.routeReorderBtns}>
                      <TouchableOpacity
                        style={[styles.reorderBtn, idx === 0 && styles.reorderBtnDisabled]}
                        onPress={() => moveStop(idx, 'up')}
                        disabled={idx === 0}
                      >
                        <Ionicons
                          name="arrow-up"
                          size={14}
                          color={idx === 0 ? colors.textDim : colors.textMuted}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reorderBtn,
                          idx === routeStops.length - 1 && styles.reorderBtnDisabled,
                        ]}
                        onPress={() => moveStop(idx, 'down')}
                        disabled={idx === routeStops.length - 1}
                      >
                        <Ionicons
                          name="arrow-down"
                          size={14}
                          color={idx === routeStops.length - 1 ? colors.textDim : colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.routeModalActions}>
              <TouchableOpacity style={styles.routeActionBtn} onPress={openRouteMaps}>
                <Ionicons name="map" size={16} color={colors.white} />
                <Text style={styles.routeActionBtnText}>Abrir en Maps</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.routeActionBtn, styles.routeActionBtnSecondary]} onPress={shareRoute}>
                <Ionicons name="share-outline" size={16} color={colors.primary} />
                <Text style={[styles.routeActionBtnText, { color: colors.primary }]}>Compartir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.routeActionBtn, styles.routeActionBtnWhatsapp]} onPress={openWhatsApp}>
                <Ionicons name="logo-whatsapp" size={16} color={colors.white} />
                <Text style={styles.routeActionBtnText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
          </View>
        </View>
      </Modal>
    </>
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
    backgroundColor: colors.surface, marginHorizontal: 12, marginBottom: 4, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  // Content
  content: { padding: 12, paddingBottom: 90 },

  // Full route banner
  fullRouteBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
  },
  fullRouteBannerText: {
    flex: 1, fontSize: 13, fontWeight: '700', color: colors.white,
  },

  // Info bar row
  infoBarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  infoBar: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.surface, borderRadius: 10, padding: 10,
  },
  infoBarText: { fontSize: 12, color: colors.textDim, flex: 1, lineHeight: 16 },

  // Selection toggle button
  selectionToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  selectionToggleBtnActive: {
    borderColor: colors.danger + '55',
    backgroundColor: colors.danger + '11',
  },
  selectionToggleBtnText: {
    fontSize: 12, fontWeight: '600', color: colors.primary,
  },

  // Zone section
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
  zoneMapsBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.primary + '18', justifyContent: 'center', alignItems: 'center',
  },

  // Empty
  emptyCard: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textMuted },
  emptySubtitle: { fontSize: 13, color: colors.textDim, textAlign: 'center', paddingHorizontal: 20 },

  // Pending card
  pendingCard: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: colors.warning,
  },
  pendingCardSelected: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.primary + '18',
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

  // Selection circle
  selectionCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  selectionCircleFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectionCircleText: { fontSize: 12, fontWeight: '800', color: colors.white },

  // Client card (zonas tab)
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

  // Floating bottom bar
  floatingBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 10,
  },
  floatingBarInfo: { flex: 1, gap: 2 },
  floatingBarCount: { fontSize: 13, fontWeight: '700', color: colors.text },
  floatingBarTotal: { fontSize: 12, color: colors.textMuted },
  floatingBarActions: { flexDirection: 'row', gap: 8 },
  floatingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  floatingBtnPrimary: { backgroundColor: colors.primary },
  floatingBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: colors.white },
  floatingBtnSecondary: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
  },
  floatingBtnSecondaryText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  floatingBtnDisabled: { opacity: 0.4 },

  // Route modal
  routeModalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)',
  },
  routeModalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 12,
  },
  routeModalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12,
  },
  routeModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  routeModalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  routeStopList: { paddingHorizontal: 16, paddingTop: 12 },
  routeStopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.bg, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  routeStopBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  routeStopBadgeText: { fontSize: 13, fontWeight: '800', color: colors.white },
  routeStopName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  routeStopAddress: { fontSize: 12, color: colors.textMuted, marginBottom: 1 },
  routeStopPhone: { fontSize: 12, color: colors.textMuted, marginBottom: 1 },
  routeStopAmount: { fontSize: 12, fontWeight: '700', color: colors.success },
  routeReorderBtns: { gap: 4, flexShrink: 0 },
  reorderBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  reorderBtnDisabled: { opacity: 0.35 },

  // Route modal action buttons
  routeModalActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  routeActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 11,
  },
  routeActionBtnSecondary: {
    backgroundColor: colors.primary + '18',
    borderWidth: 1, borderColor: colors.primary + '44',
  },
  routeActionBtnWhatsapp: {
    backgroundColor: '#25D366',
  },
  routeActionBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
});
