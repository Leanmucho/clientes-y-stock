import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../lib/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius, backgroundColor: colors.border, opacity },
        style,
      ]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.statCard}>
            <SkeletonBox width={24} height={24} borderRadius={12} />
            <SkeletonBox width={40} height={22} />
            <SkeletonBox width={60} height={12} />
          </View>
        ))}
      </View>
      <View style={styles.plRow}>
        <View style={[styles.plCard, { flex: 1 }]}>
          <SkeletonBox width={60} height={12} />
          <SkeletonBox width={80} height={20} style={{ marginTop: 6 }} />
        </View>
        <View style={[styles.plCard, { flex: 1 }]}>
          <SkeletonBox width={60} height={12} />
          <SkeletonBox width={80} height={20} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBox height={56} borderRadius={14} style={{ marginBottom: 12 }} />
      <SkeletonBox width={140} height={18} style={{ marginBottom: 12 }} />
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.installmentCard}>
          <SkeletonBox width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="60%" height={14} />
            <SkeletonBox width="40%" height={12} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <SkeletonBox width={70} height={16} />
            <SkeletonBox width={50} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ padding: 12, gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listCard}>
          <SkeletonBox width={48} height={48} borderRadius={12} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonBox width="70%" height={14} />
            <SkeletonBox width="45%" height={12} />
          </View>
          <SkeletonBox width={16} height={16} borderRadius={8} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, alignItems: 'center', gap: 8,
  },
  plRow: { flexDirection: 'row', gap: 10 },
  plCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14 },
  installmentCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  listCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
});
