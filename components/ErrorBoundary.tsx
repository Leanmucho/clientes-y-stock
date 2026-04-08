import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/colors';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={48} color={colors.danger} />
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.message} numberOfLines={4}>
          {this.state.error?.message ?? 'Error inesperado'}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={this.reset} activeOpacity={0.8}>
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.btnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.bg,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  message: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
