import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/colors';

interface BarcodeScannerProps {
  visible: boolean;
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ visible, onScan, onClose }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    onScan(data);
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.permBox}>
            <Ionicons name="scan-outline" size={40} color={colors.primary} />
            <Text style={styles.permText}>Cargando cámara...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.permBox}>
            <Ionicons name="camera-outline" size={48} color={colors.primary} />
            <Text style={styles.permTitle}>Permiso de cámara</Text>
            <Text style={styles.permText}>
              Se necesita acceso a la cámara para escanear códigos de barras.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission} activeOpacity={0.8}>
              <Text style={styles.permBtnText}>Permitir acceso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Escanear producto</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.frame}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <View style={styles.bottomBar}>
          <Text style={styles.hint}>Apuntá al código de barras del producto</Text>
          {scanned && (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)} activeOpacity={0.8}>
              <Ionicons name="refresh" size={16} color={colors.white} />
              <Text style={styles.rescanText}>Escanear de nuevo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  permBox: { backgroundColor: colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', gap: 12, width: '100%' },
  permTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  permText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  permBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  permBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 8 },
  cancelText: { color: colors.textDim, fontSize: 14 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  topTitle: { fontSize: 16, fontWeight: '700', color: colors.white },
  frame: {
    position: 'absolute', top: '50%', left: '50%',
    width: FRAME_SIZE, height: FRAME_SIZE,
    marginTop: -FRAME_SIZE / 2, marginLeft: -FRAME_SIZE / 2,
  },
  corner: {
    position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: colors.white, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS,
    top: 0, left: 0,
  },
  cornerTR: { left: undefined, right: 0, borderLeftWidth: 0, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { top: undefined, bottom: 0, borderTopWidth: 0, borderBottomWidth: CORNER_THICKNESS },
  cornerBR: {
    top: undefined, left: undefined, bottom: 0, right: 0,
    borderTopWidth: 0, borderLeftWidth: 0,
    borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 32, alignItems: 'center', gap: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center' },
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
  },
  rescanText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
